import { NextResponse } from "next/server";
import crypto from "node:crypto";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { executeSql, parseJsonValue, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${base || "item"}-${crypto.randomBytes(3).toString("hex")}`;
}

function normalizeImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith("/") || u.startsWith("https://") || u.startsWith("http://"));
}

export async function GET() {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rows = await queryRows<RowDataPacket>(
    `SELECT id, slug, title, division, listing_kind, description, location, specs,
            image_urls, amount_kes, price_unit, stock_quantity, status, purchasable, featured, booking_kind, updated_at
     FROM products
     ORDER BY status = 'archived' ASC, featured DESC, created_at DESC`,
  );

  return NextResponse.json({
    products: rows.map((r) => ({
      ...r,
      specs: parseJsonValue(r.specs, {}),
      image_urls: parseJsonValue<string[]>(r.image_urls, []),
      amount_kes: Number(r.amount_kes),
      stock_quantity: Number(r.stock_quantity),
      purchasable: Boolean(r.purchasable),
      featured: Boolean(r.featured),
    })),
  });
}

export async function POST(request: Request) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    title?: string;
    division?: "Vehicles" | "Real Estate" | "Sanitation" | "Other";
    listing_kind?: string;
    description?: string;
    location?: string;
    specs?: Record<string, unknown>;
    amount_kes?: number;
    price_unit?: string;
    stock_quantity?: number;
    image_urls?: string[];
    booking_kind?: string;
    purchasable?: boolean;
    status?: string;
  } | null;

  if (!body?.title?.trim() || !["Vehicles", "Real Estate", "Sanitation", "Other"].includes(body.division || "") ||
      !Number.isSafeInteger(body.amount_kes) || (body.amount_kes || 0) <= 0 || (body.amount_kes || 0) > 500_000_000) {
    return NextResponse.json({ error: "Provide valid title, division, and positive KES price." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const imageUrls = normalizeImageUrls(body.image_urls);
  const bookingKind = ["none", "car", "short_stay", "sanitation"].includes(body.booking_kind || "")
    ? body.booking_kind!
    : "none";
  const listingKind = [
    "vehicle_sale", "vehicle_hire", "property_sale", "property_rent", "short_stay", "sanitation_package", "general",
  ].includes(body.listing_kind || "")
    ? body.listing_kind!
    : "general";
  const priceUnit = ["total", "per_day", "per_night", "per_month", "per_trip"].includes(body.price_unit || "")
    ? body.price_unit!
    : "total";
  const status = ["available", "reserved", "booked", "sold", "unavailable", "draft"].includes(body.status || "")
    ? body.status!
    : "available";
  const stockQty = Math.max(0, Math.min(999, Math.trunc(Number(body.stock_quantity ?? 1))));
  const purchasable = body.purchasable !== undefined ? (body.purchasable ? 1 : 0) : 1;

  await executeSql(
    `INSERT INTO products (
       id, slug, title, division, listing_kind, description, location, specs,
       image_urls, amount_kes, price_unit, stock_quantity, status, purchasable, featured, booking_kind, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      slugify(body.title),
      body.title.trim(),
      body.division,
      listingKind,
      (body.description || "").trim(),
      (body.location || "Kenya").trim(),
      JSON.stringify(body.specs || {}),
      JSON.stringify(imageUrls),
      body.amount_kes,
      priceUnit,
      stockQty,
      status,
      purchasable,
      bookingKind,
      staff.id,
    ],
  );

  await logAdminActivity({
    userId: staff.id,
    actorName: staff.name,
    action: "product.created",
    entityType: "product",
    entityId: id,
    details: `Created ${body.division} listing: ${body.title.trim()} (KES ${body.amount_kes?.toLocaleString()})`,
  });

  return NextResponse.json({ id, ok: true }, { status: 201 });
}
