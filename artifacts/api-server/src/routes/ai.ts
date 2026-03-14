import { Router, type IRouter, Request, Response } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import https from "https";

const router: IRouter = Router();

const GEMINI_KEY = process.env["GEMINI_API_KEY"] ?? "";

async function callGemini(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(d);
          const text =
            parsed?.candidates?.[0]?.content?.parts?.[0]?.text ??
            "Sorry, I couldn't generate a response.";
          resolve(text);
        } catch {
          reject(new Error("Failed to parse Gemini response"));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi",
  en: "English",
  pa: "Punjabi",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
};

router.post("/chat", authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { session_id, message, history, vehicle_type, language } = req.body as {
      session_id?: string;
      message?: string;
      history?: Array<{ role: string; content: string }>;
      vehicle_type?: string;
      language?: string;
    };

    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const lang = language ?? "hi";
    const langName = LANGUAGE_NAMES[lang] ?? "Hindi";
    const vehicle = vehicle_type ?? "car";

    const historyText =
      history
        ?.slice(-6)
        .map((h) => `${h.role === "user" ? "User" : "AI"}: ${h.content}`)
        .join("\n") ?? "";

    const prompt = `You are Raahi AI Mechanic, an expert vehicle mechanic assistant for Indian roads. 
You help drivers with vehicle problems, breakdowns, and road safety issues.
Reply ONLY in ${langName} language. Keep response concise and practical.
Vehicle type: ${vehicle}

${historyText ? `Previous conversation:\n${historyText}\n` : ""}
User: ${message}
AI:`;

    if (!GEMINI_KEY) {
      res.json({
        success: true,
        session_id: session_id ?? "demo",
        reply: `[Demo mode - Gemini key not configured] You asked about: "${message}". Please check your vehicle manually and contact a nearby mechanic if needed.`,
      });
      return;
    }

    const reply = await callGemini(prompt);
    res.json({ success: true, session_id: session_id ?? "default", reply });
  } catch (error) {
    console.error("AI chat error:", error);
    res.status(500).json({ error: "AI service error", details: String(error) });
  }
});

export default router;
