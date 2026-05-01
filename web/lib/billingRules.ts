export type Quality = "low" | "medium" | "high";

export type BillingRules = {
  billing_cost_multiplier: number;
  usd_price_table: Record<string, Record<Quality, number>>;
  openai_token_prices_usd_per_1m: {
    input_text: number;
    input_image: number;
    output_text: number;
    output_image: number;
  };
};

export const defaultBillingRules: BillingRules = {
  billing_cost_multiplier: 10,
  usd_price_table: {
    auto: { low: 0.1, medium: 0.2, high: 0.3 },
    "1024x1024": { low: 0.1, medium: 0.2, high: 0.3 },
    "1024x1536": { low: 0.15, medium: 0.25, high: 0.35 },
    "1536x1024": { low: 0.15, medium: 0.25, high: 0.35 },
    "2048x2048": { low: 0.4, medium: 0.8, high: 1.2 },
    "2048x1152": { low: 0.225, medium: 0.45, high: 0.675 },
    "2160x3840": { low: 0.791, medium: 1.582, high: 2.373 },
    "3840x2160": { low: 0.791, medium: 1.582, high: 2.373 },
    "1088x1920": { low: 0.1992, medium: 0.3984, high: 0.5977 },
    "1920x1088": { low: 0.1992, medium: 0.3984, high: 0.5977 },
    "1440x1440": { low: 0.1978, medium: 0.3955, high: 0.5933 },
    "1280x1920": { low: 0.2344, medium: 0.4688, high: 0.7031 },
    "1920x1280": { low: 0.2344, medium: 0.4688, high: 0.7031 },
  },
  openai_token_prices_usd_per_1m: {
    input_text: 5,
    input_image: 8,
    output_text: 0,
    output_image: 40,
  },
};

const qualities: Quality[] = ["low", "medium", "high"];

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function generatedPrice(size: string, quality: Quality, rules: BillingRules): number {
  if (size === "auto") return rules.usd_price_table["1024x1024"]?.[quality] ?? defaultBillingRules.usd_price_table["1024x1024"][quality];
  const [width, height] = size.split("x").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return rules.usd_price_table["1024x1024"]?.[quality] ?? 0.2;
  const qualityMultiplier = quality === "low" ? 0.5 : quality === "high" ? 1.5 : 1;
  const basePrice = rules.usd_price_table["1024x1024"]?.medium ?? 0.2;
  return Math.max(0.01, Number((basePrice * ((width * height) / (1024 * 1024)) * qualityMultiplier).toFixed(4)));
}

export function normalizeBillingRules(input: unknown): BillingRules {
  if (!input || typeof input !== "object") return defaultBillingRules;
  const raw = input as Partial<BillingRules>;
  const normalized: BillingRules = {
    billing_cost_multiplier: positiveNumber(raw.billing_cost_multiplier, defaultBillingRules.billing_cost_multiplier),
    usd_price_table: { ...defaultBillingRules.usd_price_table },
    openai_token_prices_usd_per_1m: {
      input_text: positiveNumber(
        raw.openai_token_prices_usd_per_1m?.input_text,
        defaultBillingRules.openai_token_prices_usd_per_1m.input_text
      ),
      input_image: positiveNumber(
        raw.openai_token_prices_usd_per_1m?.input_image,
        defaultBillingRules.openai_token_prices_usd_per_1m.input_image
      ),
      output_text: positiveNumber(
        raw.openai_token_prices_usd_per_1m?.output_text,
        defaultBillingRules.openai_token_prices_usd_per_1m.output_text
      ),
      output_image: positiveNumber(
        raw.openai_token_prices_usd_per_1m?.output_image,
        defaultBillingRules.openai_token_prices_usd_per_1m.output_image
      ),
    },
  };

  Object.entries(raw.usd_price_table ?? {}).forEach(([size, prices]) => {
    const fallback = normalized.usd_price_table[size] ?? {
      low: generatedPrice(size, "low", normalized),
      medium: generatedPrice(size, "medium", normalized),
      high: generatedPrice(size, "high", normalized),
    };
    normalized.usd_price_table[size] = {
      low: positiveNumber(prices?.low, fallback.low),
      medium: positiveNumber(prices?.medium, fallback.medium),
      high: positiveNumber(prices?.high, fallback.high),
    };
  });

  return normalized;
}

export function ensurePriceRowsForSizes(rules: BillingRules, sizes: string[]): BillingRules {
  const next = normalizeBillingRules(rules);
  sizes.forEach((size) => {
    if (next.usd_price_table[size]) return;
    next.usd_price_table[size] = {
      low: generatedPrice(size, "low", next),
      medium: generatedPrice(size, "medium", next),
      high: generatedPrice(size, "high", next),
    };
  });
  return next;
}

export function estimatePoints(size: string, quality: Quality, rules: BillingRules): number {
  const normalized = normalizeBillingRules(rules);
  const usd = normalized.usd_price_table[size]?.[quality] ?? generatedPrice(size, quality, normalized);
  return Math.round(usd * normalized.billing_cost_multiplier * 100);
}

export function qualityKeys(): Quality[] {
  return qualities;
}
