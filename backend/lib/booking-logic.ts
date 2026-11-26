import crypto from "node:crypto";

export function generateTrackingCode(prefix: "APP" | "APT" | "INQ" | "ORD"): string {
  const year = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `YEL-${prefix}-${year}-${rand}`;
}

export type BookingKind = "none" | "car" | "short_stay" | "sanitation";

export type SanitationQuoteInput = {
  serviceName: string;
  capacityTier?: "small" | "medium" | "large";
  frequency?: "one_off" | "weekly" | "monthly";
  urgency?: "standard" | "emergency";
};

const SANITATION_BASE_RATES: Record<string, number> = {
  "Septic Tank Cleaning (Exhauster)": 8500,
  "Garbage Collection": 3500,
  "Waste Management Solutions": 14000,
  "Commercial & Residential Cleaning": 12000,
  "Skip Bin & Construction Waste Disposal": 18000,
};

const CAPACITY_MULTIPLIER: Record<string, number> = {
  small: 1.0,
  medium: 1.35,
  large: 1.75,
};

const FREQUENCY_DISCOUNT: Record<string, number> = {
  one_off: 1.0,
  weekly: 0.9,
  monthly: 0.85,
};

export function calculateSanitationQuote(input: SanitationQuoteInput): {
  baseKes: number;
  estimatedKes: number;
  breakdown: {
    base: number;
    capacityMultiplier: number;
    frequencyDiscountPercent: number;
    emergencySurchargePercent: number;
  };
} {
  const base = SANITATION_BASE_RATES[input.serviceName] ?? 9500;
  const capacityMult = CAPACITY_MULTIPLIER[input.capacityTier || "medium"] ?? 1.0;
  const freqMult = FREQUENCY_DISCOUNT[input.frequency || "one_off"] ?? 1.0;
  const urgencyMult = input.urgency === "emergency" ? 1.25 : 1.0;

  const estimatedKes = Math.round((base * capacityMult * freqMult * urgencyMult) / 100) * 100;
  return {
    baseKes: base,
    estimatedKes,
    breakdown: {
      base,
      capacityMultiplier: capacityMult,
      frequencyDiscountPercent: Math.round((1 - freqMult) * 100),
      emergencySurchargePercent: urgencyMult > 1 ? 25 : 0,
    },
  };
}

export function computeBookingMultiplier(
  bookingKind: BookingKind,
  details: Record<string, string>,
): { units: number; startMs: number | null; endMs: number | null; label: string } {
  if (bookingKind === "short_stay") {
    const startMs = Date.parse(`${details.check_in || ""}T00:00:00Z`);
    const endMs = Date.parse(`${details.check_out || ""}T00:00:00Z`);
    if (!details.check_in || !details.check_out || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error("Choose a valid check-in and check-out date.");
    }
    const nights = Math.max(1, Math.round((endMs - startMs) / 86_400_000));
    if (nights > 90) throw new Error("Short-stay bookings cannot exceed 90 nights online.");
    return { units: nights, startMs, endMs, label: `${nights} night${nights > 1 ? "s" : ""}` };
  }
  if (bookingKind === "car") {
    const startMs = Date.parse(details.pickup_at || "");
    const endMs = Date.parse(details.return_at || "");
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      throw new Error("Choose a valid car pickup and return date/time.");
    }
    const days = Math.max(1, Math.ceil((endMs - startMs) / 86_400_000));
    if (days > 90) throw new Error("Vehicle hire bookings cannot exceed 90 days online.");
    return { units: days, startMs, endMs, label: `${days} day${days > 1 ? "s" : ""}` };
  }
  return { units: 1, startMs: null, endMs: null, label: "" };
}
