import express, { type Express, Request, Response } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { getFirebaseAdmin } from "./lib/firebase.js";

const app: Express = express();

const allowedOrigins = [
  "https://backend-deployer--enlighenavi.replit.app",
  /^https:\/\/.*\.replit\.app$/,
  /^https:\/\/.*\.replit\.dev$/,
  "http://localhost:3000",
  "http://localhost:8080",
  "http://10.0.2.2:3000",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const allowed = allowedOrigins.some((pattern) => {
        if (typeof pattern === "string") return pattern === origin;
        return pattern.test(origin);
      });
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Raahi API Server", version: "1.0.0", status: "running" });
});

app.use("/api", router);

app.get("/api", (_req: Request, res: Response) => {
  res.json({
    message: "Raahi API",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/health",
      healthz: "GET /api/healthz",
      googleAuth: "POST /api/auth/google",
      sendOtp: "POST /api/auth/send-otp",
      verifyOtp: "POST /api/auth/verify-otp",
      login: "POST /api/auth/login",
    },
  });
});

try {
  getFirebaseAdmin();
  console.log("Firebase Admin initialized successfully");
} catch (err) {
  console.warn("Firebase Admin initialization warning:", err);
}

export default app;
