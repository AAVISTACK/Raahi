import express, { type Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { getFirebaseAdmin } from "./lib/firebase.js";

const app: Express = express();

// ─── CORS — Flutter mobile + web clients ─────────────────────
// Flutter mobile: no Origin header → allowedOrigins check skipped by cors()
// Web previews: wildcard (acceptable for a mobile-first API)
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "").split(",").filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      // Allow explicitly listed origins OR allow all if none configured
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-admin-secret"],
  })
);

// ─── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Simple rate limiter for all routes (in-memory) ───────────
// 200 requests per 15 minutes per IP
const generalRateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_MAX    = 200;

app.use((req: Request, res: Response, next: NextFunction): void => {
  const ip  = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  const now = Date.now();
  const entry = generalRateMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    generalRateMap.set(ip, { count: 1, windowStart: now });
    next(); return;
  }
  if (entry.count >= RATE_MAX) {
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return;
  }
  entry.count++;
  next();
});

// ─── Root info ────────────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Raahi API Server", version: "1.0.0", status: "running" });
});

const apiInfo = (_req: Request, res: Response) => {
  res.json({
    message: "Raahi API",
    version: "1.0.0",
    endpoints: {
      health:           "GET  /api/v1/health",
      healthz:          "GET  /api/v1/healthz",
      googleAuth:       "POST /api/v1/auth/google",
      sendOtp:          "POST /api/v1/auth/send-otp",
      verifyOtp:        "POST /api/v1/auth/verify-otp",
      login:            "POST /api/v1/auth/login",
      getProfile:       "GET  /api/v1/users/profile",
      updateProfile:    "POST /api/v1/users/profile",
      updateLocation:   "PATCH /api/v1/users/location",
      createJob:        "POST /api/v1/jobs",
      myJobs:           "GET  /api/v1/jobs/my",
      getJob:           "GET  /api/v1/jobs/:id",
      acceptJob:        "POST /api/v1/jobs/:id/accept",
      arriveJob:        "POST /api/v1/jobs/:id/arrive",
      completeJob:      "POST /api/v1/jobs/:id/complete",
      nearbyMechanics:  "GET  /api/v1/mechanics/nearby",
      registerMechanic: "POST /api/v1/mechanics/register",
      aiChat:           "POST /api/v1/ai/chat",
      submitRating:     "POST /api/v1/ratings",
      userRatings:      "GET  /api/v1/ratings/user/:userId",
      triggerSos:       "POST /api/v1/sos",
      mySos:            "GET  /api/v1/sos/my",
      getProducts:      "GET  /api/v1/shop/products",
      placeOrder:       "POST /api/v1/shop/orders",
      myOrders:         "GET  /api/v1/shop/orders/mine",
      dailyTip:         "GET  /api/v1/tips/daily",
      getStreak:        "GET  /api/v1/streak",
      checkIn:          "POST /api/v1/streak/check-in",
      fuelPrices:       "GET  /api/v1/fuel-prices?city=Delhi",
    },
  });
};

app.use("/api/v1", router);
app.use("/api", router);

app.get("/api/v1", apiInfo);
app.get("/api", apiInfo);

// ─── Firebase Admin init ─────────────────────────────────────
try {
  getFirebaseAdmin();
  console.log("Firebase Admin initialized");
} catch (err) {
  console.warn("Firebase Admin init warning:", err);
}

export default app;
