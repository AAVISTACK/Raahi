import { Router, type IRouter, Request, Response } from "express";
import { verifyFirebaseToken } from "../lib/firebase.js";
import { signToken } from "../lib/jwt.js";

const router: IRouter = Router();

router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      idToken?: string;
      id_token?: string;
      firebase_token?: string;
      email?: string;
      name?: string;
      photo_url?: string;
      google_id?: string;
    };

    const token = body.firebase_token ?? body.idToken ?? body.id_token;

    if (!token) {
      res.status(400).json({ error: "firebase_token (or idToken) is required" });
      return;
    }

    const decoded = await verifyFirebaseToken(token);
    const { uid, email, name, picture } = decoded;
    const isNewUser = !!(decoded.additionalUserInfo?.isNewUser) ||
      (decoded.auth_time === decoded.iat);

    const jwtToken = signToken({ userId: uid, email: email ?? undefined, provider: "google" });

    res.json({
      success: true,
      token: jwtToken,
      is_new_user: isNewUser,
      user: {
        uid,
        email: email ?? body.email,
        name: name ?? body.name,
        picture: picture ?? body.photo_url,
        provider: "google",
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Invalid Google token", details: String(error) });
  }
});

router.post("/otp/send", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ error: "phone number is required" });
      return;
    }
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: "Invalid phone. Use E.164 format e.g. +919876543210" });
      return;
    }
    res.json({
      success: true,
      message: "OTP sent via Firebase Phone Auth. Use verificationId from your app to verify.",
      phone,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process OTP request", details: String(error) });
  }
});

router.post("/send-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone) {
      res.status(400).json({ error: "phone number is required" });
      return;
    }
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    if (!phoneRegex.test(phone)) {
      res.status(400).json({ error: "Invalid phone. Use E.164 format e.g. +919876543210" });
      return;
    }
    res.json({
      success: true,
      message: "OTP sent via Firebase Phone Auth. Use verificationId from your app to verify.",
      phone,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process OTP request", details: String(error) });
  }
});

router.post("/otp/verify", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, id_token, phone } = req.body as {
      idToken?: string;
      id_token?: string;
      phone?: string;
    };
    const token = idToken ?? id_token;

    if (!token) {
      res.status(400).json({ error: "id_token is required (Firebase phone auth token)" });
      return;
    }

    const decoded = await verifyFirebaseToken(token);
    const { uid, phone_number } = decoded;
    const isNewUser = decoded.auth_time === decoded.iat;

    const jwtToken = signToken({
      userId: uid,
      phone: phone_number ?? phone ?? undefined,
      provider: "phone",
    });

    res.json({
      success: true,
      token: jwtToken,
      is_new_user: isNewUser,
      user: { uid, phone: phone_number ?? phone, provider: "phone" },
    });
  } catch (error) {
    console.error("OTP verify error:", error);
    res.status(401).json({ error: "Invalid or expired OTP token", details: String(error) });
  }
});

router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, id_token, phone } = req.body as {
      idToken?: string;
      id_token?: string;
      phone?: string;
    };
    const token = idToken ?? id_token;

    if (!token) {
      res.status(400).json({ error: "idToken is required (Firebase phone auth token)" });
      return;
    }

    const decoded = await verifyFirebaseToken(token);
    const { uid, phone_number } = decoded;
    const isNewUser = decoded.auth_time === decoded.iat;

    const jwtToken = signToken({
      userId: uid,
      phone: phone_number ?? phone ?? undefined,
      provider: "phone",
    });

    res.json({
      success: true,
      token: jwtToken,
      is_new_user: isNewUser,
      user: { uid, phone: phone_number ?? phone, provider: "phone" },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(401).json({ error: "Invalid or expired OTP token", details: String(error) });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, id_token, firebase_token, provider } = req.body as {
      idToken?: string;
      id_token?: string;
      firebase_token?: string;
      provider?: string;
    };
    const token = firebase_token ?? idToken ?? id_token;

    if (!token) {
      res.status(400).json({ error: "idToken (or firebase_token) is required" });
      return;
    }

    const decoded = await verifyFirebaseToken(token);
    const { uid, email, phone_number, name, picture } = decoded;
    const authProvider = (provider === "phone" ? "phone" : "google") as "google" | "phone";
    const isNewUser = decoded.auth_time === decoded.iat;

    const jwtToken = signToken({
      userId: uid,
      email: email ?? undefined,
      phone: phone_number ?? undefined,
      provider: authProvider,
    });

    res.json({
      success: true,
      token: jwtToken,
      is_new_user: isNewUser,
      user: { uid, email, phone: phone_number, name, picture, provider: authProvider },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: "Authentication failed", details: String(error) });
  }
});

export default router;
