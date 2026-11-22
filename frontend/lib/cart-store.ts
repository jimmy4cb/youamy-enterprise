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

const storageKey = "youamy-browser-cart";

export function readCart(): BrowserCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) as BrowserCartItem[] : [];
  } catch {
    return [];
  }
}

export function writeCart(items: BrowserCartItem[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("youamy-cart-change"));
}

export function addToCart(item: Omit<BrowserCartItem, "quantity" | "booking_details">) {
  const items = readCart();
  const existing = items.find((entry) => entry.product_id === item.product_id);
  if (existing) existing.quantity = Math.min(existing.quantity + 1, 20);
  else items.push({ ...item, quantity: 1, booking_details: {} });
  writeCart(items);
}
