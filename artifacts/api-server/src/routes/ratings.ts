import { Router, type IRouter, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router: IRouter = Router();

interface Rating {
  id: string;
  job_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  review: string | null;
  tags: string[];
  created_at: string;
}

const ratingStore = new Map<string, Rating>();

router.post("/", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { job_id, rated_id, rating, review, tags } = req.body as {
    job_id?: string;
    rated_id?: string;
    rating?: number;
    review?: string;
    tags?: string[];
  };

  if (!job_id || !rated_id || rating === undefined) {
    res.status(400).json({ error: "job_id, rated_id, and rating are required" });
    return;
  }

  if (rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  const newRating: Rating = {
    id: crypto.randomUUID(),
    job_id,
    rater_id: req.user!.userId,
    rated_id,
    rating,
    review: review ?? null,
    tags: tags ?? [],
    created_at: new Date().toISOString(),
  };

  ratingStore.set(newRating.id, newRating);
  res.status(201).json({ success: true, rating: newRating });
});

router.get("/user/:userId", (req, res): void => {
  const userRatings = Array.from(ratingStore.values()).filter(
    (r) => r.rated_id === req.params.userId
  );
  const avg =
    userRatings.length > 0
      ? userRatings.reduce((s, r) => s + r.rating, 0) / userRatings.length
      : 0;
  res.json({ success: true, ratings: userRatings, average: avg.toFixed(1) });
});

export default router;
