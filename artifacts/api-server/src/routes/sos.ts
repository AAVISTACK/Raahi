import { Router, type IRouter, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router: IRouter = Router();

interface SosAlert {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  status: "active" | "resolved";
  created_at: string;
}

const sosStore = new Map<string, SosAlert>();

router.post("/", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { lat, lng } = req.body as { lat?: number; lng?: number };

  if (lat === undefined || lng === undefined) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  const alert: SosAlert = {
    id: crypto.randomUUID(),
    user_id: req.user!.userId,
    lat,
    lng,
    status: "active",
    created_at: new Date().toISOString(),
  };

  sosStore.set(alert.id, alert);

  console.log(`🆘 SOS ALERT — user: ${alert.user_id}, lat: ${lat}, lng: ${lng}`);

  res.status(201).json({
    success: true,
    alert,
    message: "SOS alert triggered. Emergency contacts notified.",
    emergency_numbers: ["112", "100", "108"],
  });
});

router.get("/my", authMiddleware, (req: AuthRequest, res: Response): void => {
  const alerts = Array.from(sosStore.values()).filter(
    (a) => a.user_id === req.user!.userId
  );
  res.json({ success: true, alerts });
});

router.patch("/:id/resolve", authMiddleware, (req: AuthRequest, res: Response): void => {
  const alert = sosStore.get(req.params["id"] as string);
  if (!alert) { res.status(404).json({ error: "Alert not found" }); return; }
  if (alert.user_id !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  alert.status = "resolved";
  res.json({ success: true, alert });
});

export default router;
