import { Router, type IRouter, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";

const router: IRouter = Router();

interface StreakRecord {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastCheckIn: string | null;
  totalCheckIns: number;
  checkInDates: string[];
}

const streakStore = new Map<string, StreakRecord>();

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

// GET /api/v1/streak
router.get("/", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const record = streakStore.get(uid) ?? {
    userId: uid,
    currentStreak: 0,
    longestStreak: 0,
    lastCheckIn: null,
    totalCheckIns: 0,
    checkInDates: [],
  };
  const today = todayStr();
  const canCheckIn = record.lastCheckIn !== today;
  res.json({ success: true, streak: record, can_check_in: canCheckIn, today });
});

// POST /api/v1/streak/check-in
router.post("/check-in", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const today = todayStr();
  const yesterday = yesterdayStr();

  let record = streakStore.get(uid) ?? {
    userId: uid,
    currentStreak: 0,
    longestStreak: 0,
    lastCheckIn: null,
    totalCheckIns: 0,
    checkInDates: [],
  };

  if (record.lastCheckIn === today) {
    res.status(400).json({ error: "Already checked in today", streak: record });
    return;
  }

  // Extend or reset streak
  if (record.lastCheckIn === yesterday) {
    record.currentStreak += 1;
  } else {
    record.currentStreak = 1; // reset
  }

  if (record.currentStreak > record.longestStreak) {
    record.longestStreak = record.currentStreak;
  }

  record.lastCheckIn = today;
  record.totalCheckIns += 1;
  if (!record.checkInDates.includes(today)) {
    record.checkInDates.push(today);
    // Keep last 30 days only
    if (record.checkInDates.length > 30) record.checkInDates.shift();
  }

  streakStore.set(uid, record);

  const rewards: string[] = [];
  if (record.currentStreak === 3)  rewards.push("3-day streak badge 🔥");
  if (record.currentStreak === 7)  rewards.push("Weekly warrior badge 🏆");
  if (record.currentStreak === 30) rewards.push("Monthly legend badge 🌟");

  res.json({
    success: true,
    message: `Day ${record.currentStreak} streak! Keep it up!`,
    streak: record,
    rewards,
  });
});

export default router;
