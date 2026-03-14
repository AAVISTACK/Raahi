import { Router, type IRouter, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

const userStore = new Map<string, Record<string, unknown>>();

router.get("/profile", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const user = userStore.get(uid) ?? {
    id: uid,
    phone: req.user!.phone ?? null,
    email: req.user!.email ?? null,
    name: null,
    profile_photo: null,
    vehicle_type: "car",
    vehicle_reg: null,
    rating_avg: 0.0,
    total_helps: 0,
    wallet_balance: 0.0,
    language: "hi",
    is_verified: false,
    status: "active",
  };
  res.json({ success: true, user });
});

router.post("/profile", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const existing = userStore.get(uid) ?? {};
  const { name, profile_photo, vehicle_type, vehicle_reg, language } = req.body as {
    name?: string;
    profile_photo?: string;
    vehicle_type?: string;
    vehicle_reg?: string;
    language?: string;
  };

  const updated = {
    id: uid,
    phone: req.user!.phone ?? null,
    email: req.user!.email ?? null,
    rating_avg: 0.0,
    total_helps: 0,
    wallet_balance: 0.0,
    is_verified: false,
    status: "active",
    ...existing,
    ...(name !== undefined && { name }),
    ...(profile_photo !== undefined && { profile_photo }),
    ...(vehicle_type !== undefined && { vehicle_type }),
    ...(vehicle_reg !== undefined && { vehicle_reg }),
    ...(language !== undefined && { language }),
  };

  userStore.set(uid, updated);
  res.json({ success: true, user: updated });
});

router.patch("/location", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const { lat, lng, is_available } = req.body as {
    lat?: number;
    lng?: number;
    is_available?: boolean;
  };

  if (lat === undefined || lng === undefined) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  const existing = userStore.get(uid) ?? { id: uid };
  userStore.set(uid, { ...existing, lat, lng, is_available: is_available ?? true });

  res.json({ success: true, message: "Location updated" });
});

export default router;
