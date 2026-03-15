import { Router, type IRouter, Request, Response } from "express";
import { verifyFirebaseToken } from "../lib/firebase.js";
import { signToken } from "../lib/jwt.js";

const router: IRouter = Router();

// ─── Fast2SMS OTP ─────────────────────────────────────────────
const FAST2SMS_API_KEY = process.env["FAST2SMS_API_KEY"] ?? "";

const OTP_EXPIRY_MS       = 10 * 60 * 1000; // 10 minutes
const RATE_WINDOW_MS      = 60 * 60 * 1000; // 1 hour
const MAX_SEND_PER_HOUR   = 3;
const MAX_VERIFY_ATTEMPTS = 5;

interface OtpRecord {
  otp: string;
  expiry: number;
  verifyAttempts: number;
}
interface RateRecord { count: number; windowStart: number }

const otpStore      = new Map<string, OtpRecord>();
const sendRateStore = new Map<string, RateRecord>();

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

// Strip +91 or + prefix — Fast2SMS expects digits only, no country code
function toFast2SmsNumber(phone: string): string {
  if (phone.startsWith("+91")) return phone.slice(3);
  if (phone.startsWith("+"))   return phone.slice(1);
  return phone;
}

async function sendFast2SmsOtp(phone: string, otp: string): Promise<void> {
  if (!FAST2SMS_API_KEY) {
    console.warn("[Fast2SMS] FAST2SMS_API_KEY not configured — OTP not sent");
    return;
  }

  const number = toFast2SmsNumber(phone);
  const params = new URLSearchParams({
    authorization:    FAST2SMS_API_KEY,
    route:            "otp",
    variables_values: otp,
    numbers:          number,
    flash:            "0",
  });

  const url = `https://www.fast2sms.com/dev/bulkV2?${params.toString()}`;

  const response = await fetch(url, {
    method:  "GET",
    headers: { "cache-control": "no-cache" },
  });

  if (!response.ok) {
    throw new Error(`Fast2SMS HTTP error: ${response.status}`);
  }

  const data = await response.json() as { return?: boolean; message?: string | string[] };

  if (data.return === false) {
    const msg = Array.isArray(data.message) ? data.message.join(", ") : (data.message ?? "Unknown error");
    throw new Error(`Fast2SMS send failed: ${msg}`);
  }

  console.log(`[Fast2SMS] OTP sent to ${number}`);
}

// ─── POST /send-otp ───────────────────────────────────────────
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
      await sendFast2SmsOtp(phone, otp);
    } catch (smsErr) {
      console.error("[Fast2SMS] send error:", smsErr);
      if (!FAST2SMS_API_KEY) {
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
      expires_in_seconds: 600,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to send OTP", details: String(error) });
  }
});

// ─── POST /verify-otp ─────────────────────────────────────────
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
    const userId   = `phone_${phone.replace(/[^0-9]/g, "")}`;
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

// ─── Legacy aliases (backward compat) ────────────────────────
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
    try {
      await sendFast2SmsOtp(phone, otp);
    } catch (e) {
      if (FAST2SMS_API_KEY) { res.status(502).json({ error: "SMS send failed", details: String(e) }); return; }
      console.warn(`[DEV] OTP for ${phone}: ${otp}`);
    }
    res.json({ success: true, message: "OTP sent", phone, expires_in_seconds: 600 });
  } catch (error) { res.status(500).json({ error: String(error) }); }
});

router.post("/otp/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, idToken, id_token } = req.body as {
      phone?: string; otp?: string; idToken?: string; id_token?: string;
    };
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
    const userId   = `phone_${phone.replace(/[^0-9]/g, "")}`;
    const jwtToken = signToken({ userId, phone, provider: "phone" });
    res.json({ success: true, token: jwtToken, user: { uid: userId, phone, provider: "phone" } });
  } catch (error) { res.status(500).json({ error: String(error) }); }
});

// ─── POST /google ─────────────────────────────────────────────
router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      idToken?: string; id_token?: string; firebase_token?: string;
      email?: string; name?: string; photo_url?: string; google_id?: string;
    };
    const token = body.firebase_token ?? body.idToken ?? body.id_token;
    if (!token) { res.status(400).json({ error: "firebase_token (or idToken) is required" }); return; }
    const decoded    = await verifyFirebaseToken(token);
    const { uid, email, name, picture } = decoded;
    const isNewUser  = decoded.auth_time === decoded.iat;
    const jwtToken   = signToken({ userId: uid, email: email ?? undefined, provider: "google" });
    res.json({
      success: true, token: jwtToken, is_new_user: isNewUser,
      user: { uid, email: email ?? body.email, name: name ?? body.name, picture: picture ?? body.photo_url, provider: "google" },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid Google token", details: String(error) });
  }
});

// ─── POST /login ──────────────────────────────────────────────
router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, id_token, firebase_token } = req.body as {
      idToken?: string; id_token?: string; firebase_token?: string;
    };
    const token = firebase_token ?? idToken ?? id_token;
    if (!token) { res.status(400).json({ error: "firebase_token (or idToken) is required" }); return; }
    const decoded  = await verifyFirebaseToken(token);
    const { uid, email, phone_number, name, picture } = decoded;
    const jwtToken = signToken({ userId: uid, email: email ?? undefined, phone: phone_number ?? undefined, provider: "firebase" });
    res.json({
      success: true, token: jwtToken,
      user: { uid, email, phone: phone_number, name, picture, provider: "firebase" },
    });
  } catch (error) {
    res.status(401).json({ error: "Invalid Firebase token", details: String(error) });
  }
});

export default router;
