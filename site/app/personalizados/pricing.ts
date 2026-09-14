export type CustomCategory = "cap" | "cattle-tag" | "pet-tag";

export const CUSTOM_CATEGORIES: CustomCategory[] = ["cap", "cattle-tag", "pet-tag"];

export function isCustomCategory(value: string): value is CustomCategory {
  return CUSTOM_CATEGORIES.includes(value as CustomCategory);
}

export type CustomPricingTier = {
  minimum: number;
  shortcutLabel: string;
  priceLevel: string;
};

export const MAX_CUSTOM_QUANTITY = 5000;

const capPricingTiers: CustomPricingTier[] = [
  { minimum: 1, shortcutLabel: "1", priceLevel: "Precio unitario" },
  { minimum: 5, shortcutLabel: "5+", priceLevel: "Lote pequeño · 5+ piezas" },
  { minimum: 10, shortcutLabel: "10+", priceLevel: "Mayoreo · 10+ piezas" },
  { minimum: 30, shortcutLabel: "30+", priceLevel: "Volumen · 30+ piezas" },
];

const cattleTagPricingTiers: CustomPricingTier[] = [
  { minimum: 1, shortcutLabel: "1", priceLevel: "Precio unitario" },
  { minimum: 10, shortcutLabel: "10+", priceLevel: "Lote pequeño · 10+ piezas" },
  { minimum: 25, shortcutLabel: "25+", priceLevel: "Mayoreo · 25+ piezas" },
  { minimum: 100, shortcutLabel: "100+", priceLevel: "Volumen · 100+ piezas" },
];

/** Las placas para mascota se producen una por una: se cotizan a precio unitario. */
const petTagPricingTiers: CustomPricingTier[] = [
  { minimum: 1, shortcutLabel: "1", priceLevel: "Precio unitario" },
];

export function getCustomPricingTiers(category: CustomCategory) {
  if (category === "cap") return capPricingTiers;
  if (category === "pet-tag") return petTagPricingTiers;
  return cattleTagPricingTiers;
}

/** Las piezas con varios niveles muestran atajos de cantidad, sin prometer un precio. */
export function hasVolumePricing(category: CustomCategory) {
  return getCustomPricingTiers(category).length > 1;
}

export function normalizeCustomQuantity(quantity: number) {
  return Math.min(MAX_CUSTOM_QUANTITY, Math.max(1, Math.floor(quantity) || 1));
}

export function getCustomPricing(category: CustomCategory, quantity: number) {
  const normalizedQuantity = normalizeCustomQuantity(quantity);
  const tiers = getCustomPricingTiers(category);
  const tier = [...tiers].reverse().find((option) => normalizedQuantity >= option.minimum) ?? tiers[0];
  return { ...tier, quantity: normalizedQuantity };
}
