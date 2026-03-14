import { Router, type IRouter, Request, Response } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/auth.js";
import crypto from "crypto";

const router: IRouter = Router();

interface Product {
  id: string;
  name: string;
  description: string;
  category_id: string;
  price: number;
  discount_price: number | null;
  image_url: string;
  rating: number;
  review_count: number;
  in_stock: boolean;
  brand: string;
  amazon_url: string;
  flipkart_url: string | null;
  source: string;
}

interface Order {
  id: string;
  user_id: string;
  items: Array<{ product_id: string; quantity: number; price: number }>;
  total_amount: number;
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
  payment_method: string;
  payment_id: string | null;
  delivery_address: string;
  created_at: string;
}

const sampleProducts: Product[] = [
  {
    id: "prod-001", name: "Amaron Pro Bike Mates APBTZ5 Battery", description: "High performance bike battery, 12V 5Ah, maintenance free",
    category_id: "battery", price: 1299, discount_price: 999, image_url: "https://via.placeholder.com/200x200?text=Battery",
    rating: 4.3, review_count: 521, in_stock: true, brand: "Amaron",
    amazon_url: "https://www.amazon.in/s?k=amaron+bike+battery", flipkart_url: null, source: "amazon",
  },
  {
    id: "prod-002", name: "Bosch Wiper Blade Set (2pc)", description: "All-season frameless wiper blades, universal fit for most cars",
    category_id: "wipers", price: 799, discount_price: 649, image_url: "https://via.placeholder.com/200x200?text=Wiper",
    rating: 4.1, review_count: 234, in_stock: true, brand: "Bosch",
    amazon_url: "https://www.amazon.in/s?k=bosch+wiper+blades", flipkart_url: null, source: "amazon",
  },
  {
    id: "prod-003", name: "Castrol EDGE 5W-30 Engine Oil (3.5L)", description: "Fully synthetic engine oil, titanium fluid strength technology",
    category_id: "oil", price: 2299, discount_price: 1899, image_url: "https://via.placeholder.com/200x200?text=Oil",
    rating: 4.6, review_count: 1204, in_stock: true, brand: "Castrol",
    amazon_url: "https://www.amazon.in/s?k=castrol+edge+5w30", flipkart_url: null, source: "amazon",
  },
  {
    id: "prod-004", name: "Car Jump Starter 1000A Peak", description: "Portable jump starter for 12V vehicles, built-in LED flashlight, USB charging",
    category_id: "tools", price: 3499, discount_price: 2799, image_url: "https://via.placeholder.com/200x200?text=Jump+Starter",
    rating: 4.4, review_count: 378, in_stock: true, brand: "GOOLOO",
    amazon_url: "https://www.amazon.in/s?k=portable+jump+starter", flipkart_url: null, source: "amazon",
  },
  {
    id: "prod-005", name: "Tyre Inflator Portable Air Compressor", description: "Digital display, auto cut-off, 12V DC for car tyres",
    category_id: "tools", price: 1499, discount_price: 1199, image_url: "https://via.placeholder.com/200x200?text=Inflator",
    rating: 4.2, review_count: 892, in_stock: true, brand: "iBELL",
    amazon_url: "https://www.amazon.in/s?k=portable+tyre+inflator", flipkart_url: null, source: "amazon",
  },
  {
    id: "prod-006", name: "Car First Aid Kit (85 Piece)", description: "Comprehensive emergency kit for vehicles, waterproof case",
    category_id: "safety", price: 699, discount_price: 549, image_url: "https://via.placeholder.com/200x200?text=First+Aid",
    rating: 4.0, review_count: 312, in_stock: true, brand: "FabaCare",
    amazon_url: "https://www.amazon.in/s?k=car+first+aid+kit", flipkart_url: null, source: "amazon",
  },
];

const productStore = new Map<string, Product>(sampleProducts.map((p) => [p.id, p]));
const orderStore = new Map<string, Order>();

router.get("/products", (req: Request, res: Response): void => {
  const { category, search } = req.query as { category?: string; search?: string };
  let products = Array.from(productStore.values());

  if (category) {
    products = products.filter((p) => p.category_id === category);
  }
  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q)
    );
  }

  res.json({ success: true, products });
});

router.get("/products/:id", (req: Request, res: Response): void => {
  const product = productStore.get(req.params.id);
  if (!product) { res.status(404).json({ error: "Product not found" }); return; }
  res.json({ success: true, product });
});

router.post("/orders", authMiddleware, (req: AuthRequest, res: Response): void => {
  const { items, total_amount, payment_method, payment_id, delivery_address } = req.body as {
    items?: Array<{ product_id: string; quantity: number; price: number }>;
    total_amount?: number;
    payment_method?: string;
    payment_id?: string;
    delivery_address?: string;
  };

  if (!items?.length || !total_amount || !payment_method || !delivery_address) {
    res.status(400).json({ error: "items, total_amount, payment_method, delivery_address are required" });
    return;
  }

  const order: Order = {
    id: crypto.randomUUID(),
    user_id: req.user!.userId,
    items,
    total_amount,
    status: "pending",
    payment_method,
    payment_id: payment_id ?? null,
    delivery_address,
    created_at: new Date().toISOString(),
  };

  orderStore.set(order.id, order);
  res.status(201).json({ success: true, order, message: "Order placed successfully" });
});

router.get("/orders/mine", authMiddleware, (req: AuthRequest, res: Response): void => {
  const orders = Array.from(orderStore.values()).filter(
    (o) => o.user_id === req.user!.userId
  );
  res.json({ success: true, orders });
});

router.get("/orders/:id", authMiddleware, (req: AuthRequest, res: Response): void => {
  const order = orderStore.get(req.params.id);
  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.user_id !== req.user!.userId) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ success: true, order });
});

export default router;
