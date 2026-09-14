import { getCatalogStatus, type Product, type ProductVariant } from "./content";
import { isCustomCategory, normalizeCustomQuantity, type CustomCategory } from "./personalizados/pricing";

export const CART_STORAGE_KEY = "fierro-cart-v3";
export const LEGACY_CART_STORAGE_KEY = "fierro-cart-v2";

type CartLineBase = {
  key: string;
  productId: string;
  sku: string;
  slug: string;
  name: string;
  color: string;
  variantId: string;
  variantLabel: string;
  size: string;
  quantity: number;
  unitPrice: number;
  currency: "MXN";
  image: string | null;
  imageAlt: string;
};

export type StandardCartLine = CartLineBase & {
  lineType: "standard";
};

export type CustomCartLine = CartLineBase & {
  lineType: "custom";
  customization: {
    requestId: string;
    accessToken: string;
    reference: string;
    category: CustomCategory;
    configurationSummary: string;
    quoteStatus: "pending";
  };
};

export type CartLine = StandardCartLine | CustomCartLine;
export type CartState = { lines: CartLine[] };

export type CartAction =
  | { type: "hydrate"; state: CartState }
  | { type: "add"; line: CartLine }
  | { type: "quantity"; key: string; quantity: number }
  | { type: "remove"; key: string }
  | { type: "clear" };

export const initialCartState: CartState = { lines: [] };

export function isPurchasable(product: Product) {
  return getCatalogStatus(product) === "active" && ["gorras", "playeras"].includes(product.category) && product.price !== null && ["in_stock", "low_stock", "made_to_order", "preorder"].includes(product.inventoryStatus);
}

export function createCartLine(product: Product, variant: ProductVariant, size: string, quantity: number): StandardCartLine {
  if (product.price === null) throw new Error("El producto no tiene precio");
  const image = variant.image;
  return {
    lineType: "standard",
    key: `${product.id}:${variant.id}:${size}`,
    productId: product.id,
    sku: product.id,
    slug: product.slug,
    name: product.name,
    color: variant.color,
    variantId: variant.id,
    variantLabel: variant.label,
    size,
    quantity: clampQuantity(quantity),
    unitPrice: product.price,
    currency: product.currency,
    image: image?.src ?? null,
    imageAlt: image?.alt ?? product.name,
  };
}

export function createCustomCartLine(input: {
  requestId: string;
  accessToken: string;
  reference: string;
  category: CustomCategory;
  name: string;
  quantity: number;
  configurationSummary: string;
  image: string;
  imageAlt: string;
}): CustomCartLine {
  return {
    lineType: "custom",
    key: `custom:${input.requestId}`,
    productId: `custom-${input.category}`,
    sku: input.reference,
    slug: "personalizados",
    name: input.name,
    color: "Por confirmar",
    variantId: input.category,
    variantLabel: input.configurationSummary,
    size: "A medida",
    quantity: clampCustomQuantity(input.quantity),
    unitPrice: 0,
    currency: "MXN",
    image: input.image,
    imageAlt: input.imageAlt,
    customization: {
      requestId: input.requestId,
      accessToken: input.accessToken,
      reference: input.reference,
      category: input.category,
      configurationSummary: input.configurationSummary,
      quoteStatus: "pending",
    },
  };
}

export function isCustomLine(line: CartLine): line is CustomCartLine {
  return line.lineType === "custom";
}

export function clampQuantity(quantity: number) {
  return Math.min(10, Math.max(1, Math.floor(quantity) || 1));
}

export function clampCustomQuantity(quantity: number) {
  return normalizeCustomQuantity(quantity);
}

function clampLineQuantity(line: CartLine, quantity: number) {
  return isCustomLine(line) ? clampCustomQuantity(quantity) : clampQuantity(quantity);
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  if (action.type === "hydrate") return action.state;
  if (action.type === "clear") return initialCartState;
  if (action.type === "remove") return { lines: state.lines.filter((line) => line.key !== action.key) };
  if (action.type === "quantity") return { lines: state.lines.map((line) => line.key === action.key ? { ...line, quantity: clampLineQuantity(line, action.quantity) } : line) };
  const existing = state.lines.find((line) => line.key === action.line.key);
  if (existing) {
    return { lines: state.lines.map((line) => line.key === action.line.key ? { ...line, quantity: clampLineQuantity(line, line.quantity + action.line.quantity) } : line) };
  }
  return { lines: [...state.lines, action.line] };
}

export function cartCount(state: CartState) {
  return state.lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartSubtotal(state: CartState) {
  return state.lines.reduce((total, line) => total + (isCustomLine(line) ? 0 : line.quantity * line.unitPrice), 0);
}

export function parseStoredCart(value: string | null): CartState {
  if (!value) return initialCartState;
  try {
    const candidate = JSON.parse(value) as Partial<CartState>;
    if (!Array.isArray(candidate.lines)) return initialCartState;
    const lines = candidate.lines.flatMap((raw): CartLine[] => {
      if (!raw || typeof raw.key !== "string" || typeof raw.productId !== "string" || typeof raw.variantId !== "string" || typeof raw.variantLabel !== "string" || typeof raw.name !== "string" || typeof raw.quantity !== "number" || typeof raw.unitPrice !== "number" || raw.currency !== "MXN") return [];
      const line = { ...raw, lineType: raw.lineType === "custom" ? "custom" : "standard" } as CartLine;
      if (line.lineType === "custom") {
        const custom = line.customization;
        if (!custom || typeof custom.requestId !== "string" || typeof custom.accessToken !== "string" || typeof custom.reference !== "string") return [];
        if (!isCustomCategory(custom.category)) return [];
      }
      return [{ ...line, quantity: clampLineQuantity(line, line.quantity) }];
    });
    return { lines };
  } catch {
    return initialCartState;
  }
}
