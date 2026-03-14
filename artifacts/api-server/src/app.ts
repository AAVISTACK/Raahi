import express, { type Express, Request, Response } from "express";
import cors from "cors";
import router from "./routes/index.js";
import { getFirebaseAdmin } from "./lib/firebase.js";

const app: Express = express();

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-admin-secret"],
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Raahi API Server", version: "1.0.0", status: "running" });
});

const apiInfo = (_req: Request, res: Response) => {
  res.json({
    message: "Raahi API",
    version: "1.0.0",
    endpoints: {
      health: "GET /api/v1/health",
      healthz: "GET /api/v1/healthz",
      googleAuth: "POST /api/v1/auth/google",
      sendOtp: "POST /api/v1/auth/otp/send",
      verifyOtp: "POST /api/v1/auth/otp/verify",
      login: "POST /api/v1/auth/login",
      getProfile: "GET /api/v1/users/profile",
      updateProfile: "POST /api/v1/users/profile",
      updateLocation: "PATCH /api/v1/users/location",
      createJob: "POST /api/v1/jobs",
      getJob: "GET /api/v1/jobs/:id",
      acceptJob: "POST /api/v1/jobs/:id/accept",
      arriveJob: "POST /api/v1/jobs/:id/arrive",
      completeJob: "POST /api/v1/jobs/:id/complete",
      myJobs: "GET /api/v1/jobs/my",
      nearbyMechanics: "GET /api/v1/mechanics/nearby",
      registerMechanic: "POST /api/v1/mechanics/register",
      aiChat: "POST /api/v1/ai/chat",
      submitRating: "POST /api/v1/ratings",
      triggerSos: "POST /api/v1/sos",
      getProducts: "GET /api/v1/shop/products",
      placeOrder: "POST /api/v1/shop/orders",
      myOrders: "GET /api/v1/shop/orders/mine",
    },
  });
};

app.use("/api/v1", router);
app.use("/api", router);

app.get("/api/v1", apiInfo);
app.get("/api", apiInfo);

try {
  getFirebaseAdmin();
  console.log("Firebase Admin initialized successfully");
} catch (err) {
  console.warn("Firebase Admin initialization warning:", err);
}

export default app;
