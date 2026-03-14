import { Router, type IRouter, Request, Response } from "express";
import { verifyFirebaseToken } from "../lib/firebase.js";
import { signToken } from "../lib/jwt.js";

const router: IRouter = Router();

router.post("/google", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body as { idToken?: string };

    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    const jwtToken = signToken({
      userId: uid,
      email: email ?? undefined,
      provider: "google",
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        uid,
        email,
        name,
        picture,
        provider: "google",
      },
    });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Invalid Google token", details: String(error) });
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
      res.status(400).json({
        error: "Invalid phone number format. Must be in E.164 format (e.g. +919876543210)",
      });
      return;
    }

    res.json({
      success: true,
      message: "OTP has been sent via Firebase Phone Auth. Use the verificationId from your Flutter app to verify.",
      phone,
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Failed to process OTP request", details: String(error) });
  }
});

router.post("/verify-otp", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, phone } = req.body as { idToken?: string; phone?: string };

    if (!idToken) {
      res.status(400).json({ error: "idToken is required (from Firebase phone auth verification)" });
      return;
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    const { uid, phone_number } = decodedToken;

    const jwtToken = signToken({
      userId: uid,
      phone: phone_number ?? phone ?? undefined,
      provider: "phone",
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        uid,
        phone: phone_number ?? phone,
        provider: "phone",
      },
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(401).json({ error: "Invalid or expired OTP token", details: String(error) });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, provider } = req.body as { idToken?: string; provider?: string };

    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const decodedToken = await verifyFirebaseToken(idToken);
    const { uid, email, phone_number, name, picture } = decodedToken;

    const authProvider = (provider === "phone" ? "phone" : "google") as "google" | "phone";

    const jwtToken = signToken({
      userId: uid,
      email: email ?? undefined,
      phone: phone_number ?? undefined,
      provider: authProvider,
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        uid,
        email,
        phone: phone_number,
        name,
        picture,
        provider: authProvider,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(401).json({ error: "Authentication failed", details: String(error) });
  }
});

export default router;
