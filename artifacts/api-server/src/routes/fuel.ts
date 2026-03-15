import { Router, type IRouter, Request, Response } from "express";

const router: IRouter = Router();

// Fuel prices in INR/litre — updated periodically (static seed data)
const FUEL_PRICES: Record<string, { petrol: number; diesel: number; cng: number; updated: string }> = {
  Delhi:     { petrol: 94.77, diesel: 87.67, cng: 74.09, updated: "2025-01-01" },
  Mumbai:    { petrol: 103.44, diesel: 89.97, cng: 66.00, updated: "2025-01-01" },
  Bangalore: { petrol: 102.86, diesel: 88.94, cng: 0,     updated: "2025-01-01" },
  Chennai:   { petrol: 100.75, diesel: 92.48, cng: 0,     updated: "2025-01-01" },
  Hyderabad: { petrol: 107.41, diesel: 95.65, cng: 0,     updated: "2025-01-01" },
  Kolkata:   { petrol: 103.94, diesel: 90.76, cng: 53.46, updated: "2025-01-01" },
  Pune:      { petrol: 103.57, diesel: 90.25, cng: 74.00, updated: "2025-01-01" },
  Ahmedabad: { petrol: 96.63,  diesel: 92.38, cng: 71.00, updated: "2025-01-01" },
  Jaipur:    { petrol: 104.88, diesel: 90.36, cng: 73.00, updated: "2025-01-01" },
  Lucknow:   { petrol: 94.65,  diesel: 87.76, cng: 82.00, updated: "2025-01-01" },
  Chandigarh:{ petrol: 94.25,  diesel: 82.45, cng: 0,     updated: "2025-01-01" },
  Bhopal:    { petrol: 107.23, diesel: 90.87, cng: 0,     updated: "2025-01-01" },
  Patna:     { petrol: 105.58, diesel: 92.31, cng: 0,     updated: "2025-01-01" },
  Nagpur:    { petrol: 103.89, diesel: 90.19, cng: 0,     updated: "2025-01-01" },
  Surat:     { petrol: 96.40,  diesel: 92.10, cng: 69.50, updated: "2025-01-01" },
};

// GET /api/v1/fuel-prices?city=Delhi
router.get("/", (req: Request, res: Response): void => {
  const city = (req.query.city as string) ?? "";

  if (!city) {
    // Return all cities
    const all = Object.entries(FUEL_PRICES).map(([name, prices]) => ({ city: name, ...prices }));
    res.json({ success: true, prices: all, currency: "INR", unit: "per litre" });
    return;
  }

  // Case-insensitive match
  const key = Object.keys(FUEL_PRICES).find(
    (k) => k.toLowerCase() === city.toLowerCase()
  );

  if (!key) {
    const available = Object.keys(FUEL_PRICES).join(", ");
    res.status(404).json({
      error: `Fuel prices not found for city: ${city}`,
      available_cities: available,
    });
    return;
  }

  const prices = FUEL_PRICES[key];
  res.json({
    success: true,
    city: key,
    prices: {
      petrol: prices.petrol,
      diesel: prices.diesel,
      ...(prices.cng > 0 && { cng: prices.cng }),
    },
    currency: "INR",
    unit: "per litre",
    last_updated: prices.updated,
    note: "Prices are indicative. Check local petrol pumps for exact rates.",
  });
});

export default router;
