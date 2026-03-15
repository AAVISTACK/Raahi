import { Router, type IRouter } from "express";
import healthRouter    from "./health.js";
import authRouter      from "./auth.js";
import usersRouter     from "./users.js";
import jobsRouter      from "./jobs.js";
import mechanicsRouter from "./mechanics.js";
import aiRouter        from "./ai.js";
import ratingsRouter   from "./ratings.js";
import sosRouter       from "./sos.js";
import shopRouter      from "./shop.js";
import tipsRouter      from "./tips.js";
import streakRouter    from "./streak.js";
import fuelRouter      from "./fuel.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth",      authRouter);
router.use("/users",     usersRouter);
router.use("/jobs",      jobsRouter);
router.use("/mechanics", mechanicsRouter);
router.use("/ai",        aiRouter);
router.use("/ratings",   ratingsRouter);
router.use("/sos",       sosRouter);
router.use("/shop",      shopRouter);
router.use("/tips",      tipsRouter);
router.use("/streak",    streakRouter);
router.use("/fuel-prices", fuelRouter);

export default router;
