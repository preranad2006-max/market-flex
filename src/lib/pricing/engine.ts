/**
 * Dynamic Pricing Engine — deterministic TypeScript port of the Python
 * reference implementation (models/elasticity.py, models/optimizer.py).
 *
 * Everything here is pure + seeded so SSR and client render identically.
 */

export const CONFIG = {
  minMarginPct: 0.1, // price >= cost * 1.10
  maxSurgePct: 0.35, // price <= base * 1.35
  maxDiscountPct: 0.3, // price >= base * 0.70
  competitorCeiling: 1.15, // price <= 1.15 * min competitor
  emergencyCeiling: 1.2, // hard stop
  flashViewSpike: 3.0, // views_1h > 300% of moving average
  flashStockRatio: 0.3,
  scarcityPremium: 0.18,
  gridSteps: 61, // P0 ± 30% in 1% steps
} as const;

export type Category =
  | "Electronics"
  | "Home"
  | "Apparel"
  | "Beauty"
  | "Grocery"
  | "Sports";

export const CATEGORIES: Category[] = [
  "Electronics",
  "Home",
  "Apparel",
  "Beauty",
  "Grocery",
  "Sports",
];

export interface Sku {
  skuId: string;
  name: string;
  category: Category;
  cost: number;
  basePrice: number;
  currentPrice: number;
  stock: number;
  reorderPoint: number;
  leadTimeDays: number;
  views1h: number;
  viewsMovingAvg: number;
  purchases1h: number;
  competitorPrices: number[];
  elasticity: number; // negative
}

export interface FeatureVector {
  stockRatio: number;
  compPriceRatio: number;
  conversionRate1h: number;
  elasticityScore: number;
  seasonalIndex: number;
}

export type AppliedRule =
  | "REVENUE_OPTIMAL"
  | "FLASH_SALE_SCARCITY"
  | "STOCKOUT_GUARD"
  | "CLEARANCE_PUSH"
  | "COMPETITIVE_CEILING"
  | "MARGIN_FLOOR"
  | "MANUAL_FREEZE";

export interface PriceRecommendation {
  skuId: string;
  currentPrice: number;
  recommendedPrice: number;
  elasticity: number;
  predictedDemand: number;
  predictedRevenue: number;
  baselineRevenue: number;
  revenueUpliftPct: number;
  appliedRule: AppliedRule;
  features: FeatureVector;
  minCompetitorPrice: number;
  latencyMs: number;
  flashSale: boolean;
  stockoutRisk: number; // 0..1
}

/* ---------------------------------- rng --------------------------------- */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOUNS: Record<Category, string[]> = {
  Electronics: ["Noise-Cancel Buds", "4K Monitor", "Mech Keyboard", "Smart Hub", "USB-C Dock"],
  Home: ["Ceramic Diffuser", "Linen Duvet", "Cast Skillet", "Table Lamp", "Storage Cube"],
  Apparel: ["Merino Crew", "Tech Chino", "Rain Shell", "Knit Beanie", "Court Sneaker"],
  Beauty: ["Retinol Serum", "Clay Mask", "Lip Balm Duo", "Scalp Tonic", "SPF 50 Fluid"],
  Grocery: ["Cold Brew Pack", "Olive Oil 1L", "Protein Oats", "Chili Crisp", "Matcha Tin"],
  Sports: ["Yoga Mat Pro", "Resistance Set", "Trail Bottle", "Foam Roller", "Grip Gloves"],
};

/** Representative live sample of the 50k+ SKU catalogue. */
export function generateCatalog(count = 180, seed = 20260813): Sku[] {
  const rnd = mulberry32(seed);
  const skus: Sku[] = [];
  for (let i = 0; i < count; i++) {
    const category = CATEGORIES[i % CATEGORIES.length]!;
    const names = NOUNS[category];
    const name = `${names[Math.floor(rnd() * names.length)]!} ${String.fromCharCode(65 + Math.floor(rnd() * 26))}${Math.floor(rnd() * 90 + 10)}`;
    const cost = round2(6 + rnd() * 180);
    const basePrice = round2(cost * (1.35 + rnd() * 0.8));
    const reorderPoint = Math.floor(30 + rnd() * 140);
    const stock = Math.floor(reorderPoint * (0.05 + rnd() * 2.9));
    const viewsMovingAvg = Math.floor(40 + rnd() * 900);
    const spike = rnd() < 0.14 ? 3.2 + rnd() * 2.4 : 0.7 + rnd() * 0.9;
    const views1h = Math.floor(viewsMovingAvg * spike);
    const purchases1h = Math.floor(views1h * (0.008 + rnd() * 0.06));
    const competitorPrices = [0, 1, 2].map(() => round2(basePrice * (0.82 + rnd() * 0.34)));
    const elasticity = -(0.8 + rnd() * 2.4);
    skus.push({
      skuId: `SKU-${(100000 + i * 7).toString()}`,
      name,
      category,
      cost,
      basePrice,
      currentPrice: basePrice,
      stock,
      reorderPoint,
      leadTimeDays: 2 + Math.floor(rnd() * 12),
      views1h,
      viewsMovingAvg,
      purchases1h,
      competitorPrices,
      elasticity,
    });
  }
  return skus;
}

/* ------------------------------- features -------------------------------- */

export function seasonalIndex(date: Date): number {
  const hour = date.getUTCHours();
  const dow = date.getUTCDay();
  const daily = 0.85 + 0.35 * Math.sin(((hour - 6) / 24) * Math.PI * 2);
  const weekly = dow === 0 || dow === 6 ? 1.12 : 1.0;
  return round3(daily * weekly);
}

export function buildFeatures(sku: Sku, now: Date): FeatureVector {
  const minComp = Math.min(...sku.competitorPrices);
  return {
    stockRatio: round3(sku.stock / Math.max(1, sku.reorderPoint)),
    compPriceRatio: round3(sku.currentPrice / Math.max(0.01, minComp)),
    conversionRate1h: round3(sku.purchases1h / Math.max(1, sku.views1h)),
    elasticityScore: round3(sku.elasticity),
    seasonalIndex: seasonalIndex(now),
  };
}

/* ------------------------------- demand ---------------------------------- */

/** Q(p, X) — constant-elasticity demand with competitive + traffic modifiers. */
export function predictDemand(sku: Sku, price: number, f: FeatureVector): number {
  const baseQ = Math.max(1, sku.purchases1h || sku.views1h * 0.02);
  const priceTerm = Math.pow(price / sku.basePrice, f.elasticityScore);
  const minComp = Math.min(...sku.competitorPrices);
  const compTerm = Math.pow(minComp / price, 0.55);
  const trafficTerm = Math.pow(sku.views1h / Math.max(1, sku.viewsMovingAvg), 0.6);
  const scarcityTerm = f.stockRatio < 0.35 ? 1.1 : 1.0;
  return Math.max(0, baseQ * priceTerm * compTerm * trafficTerm * f.seasonalIndex * scarcityTerm);
}

/** Empirical arc elasticity between two observed price/quantity points. */
export function arcElasticity(p0: number, q0: number, p1: number, q1: number): number {
  if (p0 === p1 || q0 === 0) return 0;
  return round3(((q1 - q0) / q0) / ((p1 - p0) / p0));
}

export function isFlashSale(sku: Sku, f: FeatureVector): boolean {
  return (
    sku.views1h > CONFIG.flashViewSpike * Math.max(1, sku.viewsMovingAvg) &&
    f.stockRatio < CONFIG.flashStockRatio
  );
}

/* ------------------------------ optimizer -------------------------------- */

export function recommendPrice(sku: Sku, now: Date, frozen = false): PriceRecommendation {
  const f = buildFeatures(sku, now);
  const minComp = Math.min(...sku.competitorPrices);
  const flash = isFlashSale(sku, f);

  const marginFloor = sku.cost * (1 + CONFIG.minMarginPct);
  let lower = Math.max(marginFloor, sku.basePrice * (1 - CONFIG.maxDiscountPct));
  let upper = Math.min(
    sku.basePrice * (1 + CONFIG.maxSurgePct),
    minComp * CONFIG.competitorCeiling,
  );
  if (flash) upper = Math.min(sku.basePrice * (1 + CONFIG.maxSurgePct), minComp * CONFIG.emergencyCeiling);
  if (upper < lower) upper = lower;

  let best = lower;
  let bestRevenue = -1;
  let bestQ = 0;
  for (let i = 0; i < CONFIG.gridSteps; i++) {
    const p = lower + ((upper - lower) * i) / (CONFIG.gridSteps - 1);
    const q = predictDemand(sku, p, f);
    const revenue = p * q;
    if (revenue > bestRevenue) {
      bestRevenue = revenue;
      best = p;
      bestQ = q;
    }
  }

  let rule: AppliedRule = "REVENUE_OPTIMAL";

  if (flash) {
    best = Math.min(upper, best * (1 + CONFIG.scarcityPremium));
    rule = "FLASH_SALE_SCARCITY";
  } else if (f.stockRatio < 0.5) {
    best = Math.min(upper, Math.max(best, sku.currentPrice * 1.05));
    rule = "STOCKOUT_GUARD";
  } else if (f.stockRatio > 2.5) {
    best = Math.max(lower, best * 0.93);
    rule = "CLEARANCE_PUSH";
  }

  if (best >= upper - 0.005 && rule === "REVENUE_OPTIMAL") rule = "COMPETITIVE_CEILING";
  if (best <= lower + 0.005) rule = "MARGIN_FLOOR";
  if (frozen) {
    best = sku.currentPrice;
    rule = "MANUAL_FREEZE";
  }

  best = round2(best);
  const predictedDemand = round2(predictDemand(sku, best, f));
  const baselineQ = predictDemand2(sku, sku.currentPrice, f);
  const baselineRevenue = sku.currentPrice * baselineQ;
  const predictedRevenue = best * predictedDemand;

  return {
    skuId: sku.skuId,
    currentPrice: sku.currentPrice,
    recommendedPrice: best,
    elasticity: f.elasticityScore,
    predictedDemand,
    predictedRevenue: round2(predictedRevenue),
    baselineRevenue: round2(baselineRevenue),
    revenueUpliftPct: baselineRevenue > 0
      ? round2(((predictedRevenue - baselineRevenue) / baselineRevenue) * 100)
      : 0,
    appliedRule: rule,
    features: f,
    minCompetitorPrice: minComp,
    latencyMs: syntheticLatency(sku.skuId),
    flashSale: flash,
    stockoutRisk: round3(Math.max(0, Math.min(1, 1 - f.stockRatio / 1.2))),
  };
}

/** Deterministic per-SKU inference latency so SSR and client agree. */
function syntheticLatency(skuId: string): number {
  let h = 2166136261;
  for (let i = 0; i < skuId.length; i++) {
    h ^= skuId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return round3(0.18 + ((h >>> 0) % 900) / 1000);
}

function predictDemand2(sku: Sku, price: number, f: FeatureVector) {
  return predictDemand(sku, price, f);
}

/** Revenue curve across the discretized grid — used by the price explorer. */
export function revenueCurve(sku: Sku, now: Date) {
  const f = buildFeatures(sku, now);
  const minComp = Math.min(...sku.competitorPrices);
  const lo = sku.basePrice * 0.7;
  const hi = sku.basePrice * 1.35;
  const pts: { price: number; revenue: number; demand: number; competitor: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const price = round2(lo + ((hi - lo) * i) / 39);
    const demand = predictDemand(sku, price, f);
    pts.push({ price, revenue: round2(price * demand), demand: round2(demand), competitor: minComp });
  }
  return pts;
}

/* ------------------------------ streaming -------------------------------- */

/** One Kafka-consumer tick: mutates market signals deterministically-ish. */
export function tickMarket(skus: Sku[], seed: number): Sku[] {
  const rnd = mulberry32(seed);
  return skus.map((s) => {
    const viewDrift = 0.85 + rnd() * 0.4;
    const views1h = Math.max(5, Math.floor(s.views1h * viewDrift + (rnd() < 0.03 ? s.viewsMovingAvg * 3 : 0)));
    const purchases1h = Math.max(0, Math.floor(views1h * (0.008 + rnd() * 0.05)));
    const stock = Math.max(0, s.stock - purchases1h + (rnd() < 0.05 ? Math.floor(s.reorderPoint * 0.8) : 0));
    const competitorPrices = s.competitorPrices.map((c) => round2(c * (0.985 + rnd() * 0.03)));
    return {
      ...s,
      views1h,
      viewsMovingAvg: Math.round(s.viewsMovingAvg * 0.9 + views1h * 0.1),
      purchases1h,
      stock,
      competitorPrices,
    };
  });
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
export function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export const RULE_LABEL: Record<AppliedRule, string> = {
  REVENUE_OPTIMAL: "Revenue optimal",
  FLASH_SALE_SCARCITY: "Flash sale premium",
  STOCKOUT_GUARD: "Stockout guard",
  CLEARANCE_PUSH: "Clearance push",
  COMPETITIVE_CEILING: "Competitor ceiling",
  MARGIN_FLOOR: "Margin floor",
  MANUAL_FREEZE: "Frozen (manual)",
};
