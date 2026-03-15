import { Router, type IRouter, Request, Response } from "express";

const router: IRouter = Router();

const TIPS = [
  { id: 1, category: "engine", title: "Engine Oil Check", title_hi: "Engine Oil Check Karo", body: "Check engine oil every 500 km or once a week on long trips. Dark or gritty oil means it's time for a change.", body_hi: "Har 500 km ya long trip mein ek baar engine oil check karo. Kala ya ganda oil change karne ka signal hai." },
  { id: 2, category: "tyre", title: "Tyre Pressure", title_hi: "Tyre Pressure", body: "Check tyre pressure monthly and before long journeys. Under-inflated tyres reduce fuel economy and cause blowouts.", body_hi: "Mahine mein ek baar aur long journey se pehle tyre pressure check karo. Kam pressure se fuel waste hota hai." },
  { id: 3, category: "safety", title: "Night Driving Safety", title_hi: "Raat Mein Drive Karo Safely", body: "Dim your high beams when approaching oncoming traffic. Keep a safe following distance of at least 3 seconds.", body_hi: "Samne se gaadi aate time high beam band karo. Kam se kam 3 second ki doori maintain karo." },
  { id: 4, category: "fuel", title: "Fuel Saving Tips", title_hi: "Petrol Bachao", body: "Maintain steady speed on highways. Sudden acceleration and braking wastes up to 20% more fuel.", body_hi: "Highway pe ek speed maintain karo. Jhatke se accelerate/brake karne se 20% zyada fuel waste hota hai." },
  { id: 5, category: "maintenance", title: "Air Filter", title_hi: "Air Filter", body: "Clean or replace your air filter every 15,000 km. A clogged filter reduces engine performance and mileage.", body_hi: "Har 15,000 km mein air filter clean ya replace karo. Banda filter engine ko slow karta hai." },
  { id: 6, category: "safety", title: "Monsoon Driving", title_hi: "Barish Mein Drive Karo", body: "In rain, keep double the following distance and avoid driving through flooded areas — just 15cm of water can stall most cars.", body_hi: "Barish mein double distance rakho. Barhe paani mein mat ghuso — 15cm paani mein gaadi band ho sakti hai." },
  { id: 7, category: "engine", title: "Warm Up Your Car", title_hi: "Gaadi Ko Warm Up Karo", body: "In cold weather, let your engine idle for 30–60 seconds before driving. Don't rev hard until the engine warms up.", body_hi: "Thandi mein 30-60 seconds idle karne do, phir chalao. Gaadi garm hone se pehle tez mat chalao." },
  { id: 8, category: "battery", title: "Battery Health", title_hi: "Battery Health", body: "Turn off all electronics before starting in extreme heat or cold. A weak battery is the #1 cause of roadside breakdowns.", body_hi: "Bahut garmi ya thandi mein start karte time electronics band karo. Kamzor battery breakdown ki sabse badi wajah hai." },
  { id: 9, category: "tyre", title: "Tyre Rotation", title_hi: "Tyre Rotation", body: "Rotate tyres every 8,000–10,000 km for even wear. Front tyres wear faster on most cars.", body_hi: "Har 8,000-10,000 km mein tyre rotate karo taaki sabka wear barabar ho." },
  { id: 10, category: "highway", title: "Highway Breakdown Protocol", title_hi: "Highway Breakdown Protocol", body: "If you breakdown: pull left, switch on hazard lights, place triangle reflector 50m behind, call Raahi for help!", body_hi: "Breakdown ho to: left karo, hazard lights on karo, 50m peeche triangle rakho, Raahi ko call karo!" },
];

// GET /api/v1/tips/daily
router.get("/daily", (req: Request, res: Response): void => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  const tip = TIPS[dayOfYear % TIPS.length];
  const lang = (req.query.lang as string) ?? "en";
  res.json({
    success: true,
    tip: {
      ...tip,
      title: lang === "hi" ? tip.title_hi : tip.title,
      body: lang === "hi" ? tip.body_hi : tip.body,
    },
    date: new Date().toISOString().split("T")[0],
  });
});

// GET /api/v1/tips — list all
router.get("/", (_req: Request, res: Response): void => {
  res.json({ success: true, tips: TIPS, total: TIPS.length });
});

export default router;
