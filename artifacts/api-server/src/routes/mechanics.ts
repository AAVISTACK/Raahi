import { Router, type IRouter, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router: IRouter = Router();

interface Mechanic {
  id: string;
  uid: string;
  name: string;
  phone: string;
  specialization: string;
  lat: number;
  lng: number;
  is_available: boolean;
  rating_avg: number;
  total_jobs: number;
  created_at: string;
}

const mechanicStore = new Map<string, Mechanic>();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/nearby", (req: Request, res: Response): void => {
  const { lat, lng, radius, specialization } = req.query as {
    lat?: string;
    lng?: string;
    radius?: string;
    specialization?: string;
  };

  if (!lat || !lng) {
    res.status(400).json({ error: "lat and lng are required" });
    return;
  }

  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  const searchRadius = parseFloat(radius ?? "20");

  let mechanics = Array.from(mechanicStore.values()).filter((m) => {
    if (!m.is_available) return false;
    const dist = haversineKm(userLat, userLng, m.lat, m.lng);
    return dist <= searchRadius;
  });

  if (specialization) {
    mechanics = mechanics.filter((m) =>
      m.specialization.toLowerCase().includes(specialization.toLowerCase())
    );
  }

  res.json({ success: true, mechanics });
});

router.post("/register", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { name, phone, specialization, lat, lng } = req.body as {
    name?: string;
    phone?: string;
    specialization?: string;
    lat?: number;
    lng?: number;
  };

  if (!name || !phone || !specialization || lat === undefined || lng === undefined) {
    res.status(400).json({ error: "name, phone, specialization, lat, lng are required" });
    return;
  }

  const existing = Array.from(mechanicStore.values()).find((m) => m.uid === req.user!.userId);
  if (existing) {
    res.status(400).json({ error: "Already registered as mechanic" });
    return;
  }

  const mechanic: Mechanic = {
    id: crypto.randomUUID(),
    uid: req.user!.userId,
    name,
    phone,
    specialization,
    lat,
    lng,
    is_available: true,
    rating_avg: 0,
    total_jobs: 0,
    created_at: new Date().toISOString(),
  };

  mechanicStore.set(mechanic.id, mechanic);
  res.status(201).json({ success: true, mechanic });
});

router.get("/:id", (req: Request, res: Response): void => {
  const mechanic = mechanicStore.get(req.params["id"] as string);
  if (!mechanic) { res.status(404).json({ error: "Mechanic not found" }); return; }
  res.json({ success: true, mechanic });
});

export default router;
