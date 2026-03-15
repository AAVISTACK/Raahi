import { Router, type IRouter, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router: IRouter = Router();

interface HelpJob {
  id: string;
  requester_id: string;
  helper_id: string | null;
  status: "pending" | "accepted" | "arrived" | "completed" | "cancelled";
  problem_type: string;
  problem_desc: string | null;
  req_lat: number;
  req_lng: number;
  reward_amount: number;
  otp: string;
  created_at: string;
  updated_at: string;
}

const jobStore = new Map<string, HelpJob>();

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

router.post("/", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { req_lat, req_lng, problem_type, problem_desc, reward_amount } = req.body as {
    req_lat?: number;
    req_lng?: number;
    problem_type?: string;
    problem_desc?: string;
    reward_amount?: number;
  };

  if (!req_lat || !req_lng || !problem_type || !reward_amount) {
    res.status(400).json({ error: "req_lat, req_lng, problem_type, reward_amount are required" });
    return;
  }

  const job: HelpJob = {
    id: crypto.randomUUID(),
    requester_id: req.user!.userId,
    helper_id: null,
    status: "pending",
    problem_type,
    problem_desc: problem_desc ?? null,
    req_lat,
    req_lng,
    reward_amount,
    otp: generateOtp(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  jobStore.set(job.id, job);
  res.status(201).json({ success: true, job });
});

router.get("/my", authMiddleware, (req: AuthRequest, res: Response): void => {
  const uid = req.user!.userId;
  const jobs = Array.from(jobStore.values()).filter(
    (j) => j.requester_id === uid || j.helper_id === uid
  );
  res.json({ success: true, jobs });
});

router.get("/:id", authMiddleware, (req: AuthRequest, res: Response): void => {
  const job = jobStore.get(req.params["id"] as string);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  res.json({ success: true, job });
});

router.post("/:id/accept", authMiddleware, (req: AuthRequest, res: Response): void => {
  const job = jobStore.get(req.params["id"] as string);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "pending") {
    res.status(400).json({ error: `Job is already ${job.status}` });
    return;
  }
  job.helper_id = req.user!.userId;
  job.status = "accepted";
  job.updated_at = new Date().toISOString();
  res.json({ success: true, job });
});

router.post("/:id/arrive", authMiddleware, (req: AuthRequest, res: Response): void => {
  const job = jobStore.get(req.params["id"] as string);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  const { otp } = req.body as { otp?: string };
  if (!otp) { res.status(400).json({ error: "otp is required" }); return; }
  if (otp !== job.otp) { res.status(400).json({ error: "Invalid OTP" }); return; }
  if (job.status !== "accepted") {
    res.status(400).json({ error: `Job must be accepted first` });
    return;
  }
  job.status = "arrived";
  job.updated_at = new Date().toISOString();
  res.json({ success: true, job });
});

router.post("/:id/complete", authMiddleware, (req: AuthRequest, res: Response): void => {
  const job = jobStore.get(req.params["id"] as string);
  if (!job) { res.status(404).json({ error: "Job not found" }); return; }
  if (job.status !== "arrived") {
    res.status(400).json({ error: "Job must be at arrived status to complete" });
    return;
  }
  job.status = "completed";
  job.updated_at = new Date().toISOString();
  res.json({ success: true, job });
});

export default router;
