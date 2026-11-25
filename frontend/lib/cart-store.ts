export type BrowserCartItem = {
  product_id: string;
  title: string;
  division: string;
  image_urls: string[];
  amount_kes: number;
  booking_kind: "none" | "car" | "short_stay";
  quantity: number;
  booking_details: Record<string, string>;
};

const key = "youamy-cart";

function notifyCartChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("youamy-cart-changed"));
  }
}

export function readCart(): BrowserCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCart(items: BrowserCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(items));
  notifyCartChanged();
}

export function cartCount(): number {
  return readCart().reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

export function addToCart(product: Omit<BrowserCartItem, "quantity" | "booking_details">) {
  const items = readCart();
  const existing = items.find((item) => item.product_id === product.product_id);
  const next = existing
    ? items.map((item) =>
        item.product_id === product.product_id
          ? { ...item, quantity: Math.min(20, item.quantity + 1) }
          : item,
      )
    : [...items, { ...product, quantity: 1, booking_details: {} }];
  writeCart(next);
  return next;
}
