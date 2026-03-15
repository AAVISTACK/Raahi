import { Router, type IRouter, Request, Response } from "express";
import https from "https";
import { verifyFirebaseToken } from "../lib/firebase.js";
import { signToken } from "../lib/jwt.js";

const router: IRouter = Router();

// ─── MSG91 OTP ────────────────────────────────────────────────
const MSG91_API_KEY    = process.env["MSG91_API_KEY"]    ?? "";
const MSG91_TEMPLATE_ID = process.env["MSG91_TEMPLATE_ID"] ?? "";

const OTP_EXPIRY_MS       = 5 * 60 * 1000;  // 5 minutes
const RATE_WINDOW_MS      = 60 * 60 * 1000; // 1 hour
const MAX_SEND_PER_HOUR   = 3;
const MAX_VERIFY_ATTEMPTS = 5;

interface OtpRecord {
  otp: string;
  expiry: number;
  verifyAttempts: number;
}
interface RateRecord { count: number; windowStart: number }

const otpStore       = new Map<string, OtpRecord>();
const sendRateStore  = new Map<string, RateRecord>();

function checkSendRate(phone: string): boolean {
  const now   = Date.now();
  const entry = sendRateStore.get(phone);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    sendRateStore.set(phone, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= MAX_SEND_PER_HOUR) return false;
  entry.count++;
  return true;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendMsg91Otp(phone: string, otp: string): Promise<void> {
  if (!MSG91_API_KEY || !MSG91_TEMPLATE_ID) {
    console.warn("[MSG91] API key or template ID not configured — OTP not sent");
    return;
  }
  // E.164 → MSG91 mobile format (no leading +)
  const mobile = phone.startsWith("+") ? phone.slice(1) : phone;
  return new Promise((resolve, reject) => {
    const path = `/api/v5/otp?otp=${otp}&template_id=${encodeURIComponent(MSG91_TEMPLATE_ID)}&mobile=${mobile}`;
    const options = {
      hostname: "control.msg91.com",
      path,
      method: "POST",
      headers: { authkey: MSG91_API_KEY, "Content-Type": "application/json" },
    };
    const req = https.request(options, (resp) => {
      let d = "";
      resp.on("data", (c) => (d += c));
      resp.on("end", () => {
        try {
          const parsed = JSON.parse(d) as { type?: string; message?: string };
          if (parsed.type === "success") resolve();
          else reject(new Error(parsed.message ?? "MSG91 send failed"));
        } catch {
          reject(new Error("Failed to parse MSG91 response"));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ─── POST /send-otp  (MSG91) ───────────────────────────────────
router.post("/send-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ error: "phone is required" });
      return;
    }
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: "Invalid phone. Use E.164 format e.g. +919876543210" });
      return;
    }

    if (!checkSendRate(phone)) {
      res.status(429).json({
        error: "Too many OTP requests. Maximum 3 per hour.",
        retry_after_seconds: 3600,
      });
      return;
    }

    const otp = generateOtp();
    otpStore.set(phone, {
      otp,
      expiry: Date.now() + OTP_EXPIRY_MS,
      verifyAttempts: 0,
    });

    try {
      await sendMsg91Otp(phone, otp);
    } catch (smsErr) {
      console.error("[MSG91] send error:", smsErr);
      // In dev/misconfigured: still store OTP but warn
      if (!MSG91_API_KEY) {
        console.warn(`[DEV] OTP for ${phone}: ${otp}`);
      } else {
        res.status(502).json({ error: "Failed to send OTP via SMS", details: String(smsErr) });
        return;
      }
    }

    res.json({
      success: true,
      message: "OTP sent successfully",
      phone,
      expires_in_seconds: 300,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP", details: String(error) });
  }
});

// ─── POST /verify-otp  (MSG91 + JWT) ──────────────────────────
router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body as { phone?: string; otp?: string };
    if (!phone || !otp) {
      res.status(400).json({ error: "phone and otp are required" });
      return;
    }

    const record = otpStore.get(phone);
    if (!record) {
      res.status(400).json({ error: "No OTP found for this number. Please request a new OTP." });
      return;
    }

    if (Date.now() > record.expiry) {
      otpStore.delete(phone);
      res.status(400).json({ error: "OTP has expired. Please request a new one." });
      return;
    }

    if (record.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
      otpStore.delete(phone);
      res.status(429).json({ error: "Too many incorrect attempts. Please request a new OTP." });
      return;
    }

    if (record.otp !== otp) {
      record.verifyAttempts++;
      const remaining = MAX_VERIFY_ATTEMPTS - record.verifyAttempts;
      res.status(400).json({
        error: "Incorrect OTP",
        attempts_remaining: remaining,
      });
      return;
    }

    // OTP verified — clean up and issue JWT
    otpStore.delete(phone);
    const userId = `phone_${phone.replace(/[^0-9]/g, "")}`;
    const jwtToken = signToken({ userId, phone, provider: "phone" });

    res.json({
      success: true,
      token: jwtToken,
      is_new_user: true,
      user: { uid: userId, phone, provider: "phone" },
    });
  } catch (error) {
    res.status(500).json({ error: "OTP verification failed", details: String(error) });
  }
});

// ─── Legacy aliases (keep backward compat) ────────────────────
router.post("/otp/send", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) { res.status(400).json({ error: "phone number is required" }); return; }
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: "Invalid phone. Use E.164 format e.g. +919876543210" }); return;
    }
    if (!checkSendRate(phone)) {
      res.status(429).json({ error: "Too many OTP requests. Maximum 3 per hour." }); return;
    }
    const otp = generateOtp();
    otpStore.set(phone, { otp, expiry: Date.now() + OTP_EXPIRY_MS, verifyAttempts: 0 });
    try { await sendMsg91Otp(phone, otp); } catch (e) {
      if (MSG91_API_KEY) { res.status(502).json({ error: "SMS send failed", details: String(e) }); return; }
      console.warn(`[DEV] OTP for ${phone}: ${otp}`);
    }
    res.json({ success: true, message: "OTP sent", phone, expires_in_seconds: 300 });
  } catch (error) { res.status(500).json({ error: String(error) }); }
});

router.post("/otp/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, idToken, id_token } = req.body as {
      phone?: string; otp?: string; idToken?: string; id_token?: string;
    };
    // Support both MSG91 OTP path and Firebase token path
    const firebaseToken = idToken ?? id_token;
    if (firebaseToken) {
      const decoded = await verifyFirebaseToken(firebaseToken);
      const { uid, phone_number } = decoded;
      const jwtToken = signToken({ userId: uid, phone: phone_number ?? phone ?? undefined, provider: "phone" });
      res.json({ success: true, token: jwtToken, user: { uid, phone: phone_number ?? phone, provider: "phone" } });
      return;
    }
    if (!phone || !otp) { res.status(400).json({ error: "phone and otp are required" }); return; }
    const record = otpStore.get(phone);
    if (!record) { res.status(400).json({ error: "No OTP found. Request a new OTP." }); return; }
    if (Date.now() > record.expiry) { otpStore.delete(phone); res.status(400).json({ error: "OTP expired" }); return; }
    if (record.verifyAttempts >= MAX_VERIFY_ATTEMPTS) { otpStore.delete(phone); res.status(429).json({ error: "Too many attempts" }); return; }
    if (record.otp !== otp) { record.verifyAttempts++; res.status(400).json({ error: "Incorrect OTP" }); return; }
    otpStore.delete(phone);
    const userId = `phone_${phone.replace(/[^0-9]/g, "")}`;
    const jwtToken = signToken({ userId, phone, provider: "phone" });
    res.json({ success: true, token: jwtToken, user: { uid: userId, phone, provider: "phone" } });
  } catch (error) { res.status(500).json({ error: String(error) }); }
});

// ─── POST /google ──────────────────────────────────────────────
router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      idToken?: string; id_token?: string; firebase_token?: string;
      email?: string; name?: string; photo_url?: string; google_id?: string;
    };
    const token = body.firebase_token ?? body.idToken ?? body.id_token;
    if (!token) { res.status(400).json({ error: "firebase_token (or idToken) is required" }); return; }
    const decoded = await verifyFirebaseToken(token);
    const { uid, email, name, picture } = decoded;
    const isNewUser = decoded.auth_time === decoded.iat;
    const jwtToken = signToken({ userId: uid, email: email ?? undefined, provider: "google" });
    res.json({
      success: true, token: jwtToken, is_new_user: isNewUser,
      user: { uid, email: email ?? body.email, name: name ?? body.name, picture: picture ?? body.photo_url, provider: "google" },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid Google token", details: String(error) });
  }
});

// ─── POST /login ───────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, id_token, firebase_token, provider } = req.body as {
      idToken?: string; id_token?: string; firebase_token?: string; provider?: string;
    };
    const token = firebase_token ?? idToken ?? id_token;
    if (!token) { res.status(400).json({ error: "idToken (or firebase_token) is required" }); return; }
    const decoded = await verifyFirebaseToken(token);
    const { uid, email, phone_number, name, picture } = decoded;
    const authProvider = (provider === "phone" ? "phone" : "google") as "google" | "phone";
    const isNewUser = decoded.auth_time === decoded.iat;
    const jwtToken = signToken({ userId: uid, email: email ?? undefined, phone: phone_number ?? undefined, provider: authProvider });
    res.json({
      success: true, token: jwtToken, is_new_user: isNewUser,
      user: { uid, email, phone: phone_number, name, picture, provider: authProvider },
    });
  } catch (error) {
    res.status(401).json({ error: "Authentication failed", details: String(error) });
  }
});

export default router;
