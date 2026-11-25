import { NextResponse } from "next/server";
import { getSessionUser, hasPermission, logAdminActivity } from "@backend/lib/admin-auth";
import { executeSql } from "@backend/lib/mysql";

function normalizeImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((u) => String(u || "").trim())
    .filter((u) => u.startsWith("/") || u.startsWith("https://") || u.startsWith("http://"));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await context.params;
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
    status?: string;
    purchasable?: boolean;
  } | null;

  if (!body?.title?.trim() || !["Vehicles", "Real Estate", "Sanitation", "Other"].includes(body.division || "") ||
      !Number.isSafeInteger(body.amount_kes) || (body.amount_kes || 0) <= 0) {
    return NextResponse.json({ error: "Product details or price are invalid." }, { status: 400 });
  }

  const status = ["available", "reserved", "booked", "sold", "unavailable", "draft", "archived"].includes(body.status || "")
    ? body.status!
    : "available";
  const bookingKind = ["none", "car", "short_stay", "sanitation"].includes(body.booking_kind || "")
    ? body.booking_kind!
    : "none";
  const priceUnit = ["total", "per_day", "per_night", "per_month", "per_trip"].includes(body.price_unit || "")
    ? body.price_unit!
    : "total";
  const listingKind = [
    "vehicle_sale", "vehicle_hire", "property_sale", "property_rent", "short_stay", "sanitation_package", "general",
  ].includes(body.listing_kind || "")
    ? body.listing_kind!
    : "general";
  const imageUrls = normalizeImageUrls(body.image_urls);
  const stockQty = Math.max(0, Math.min(999, Math.trunc(Number(body.stock_quantity ?? 1))));
  const purchasable = body.purchasable !== undefined
    ? (body.purchasable && status === "available" ? 1 : 0)
    : (status === "available" ? 1 : 0);

  await executeSql(
    `UPDATE products SET
       title = ?, division = ?, listing_kind = ?, description = ?, location = ?,
       specs = COALESCE(?, specs), image_urls = ?, amount_kes = ?, price_unit = ?,
       stock_quantity = ?, status = ?, purchasable = ?, booking_kind = ?, updated_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [
      body.title.trim(),
      body.division,
      listingKind,
      (body.description || "").trim(),
      (body.location || "Kenya").trim(),
      body.specs ? JSON.stringify(body.specs) : null,
      JSON.stringify(imageUrls),
      body.amount_kes,
      priceUnit,
      stockQty,
      status,
      purchasable,
      bookingKind,
      id,
    ],
  );

  await logAdminActivity({
    userId: staff.id,
    actorName: staff.name,
    action: "product.updated",
    entityType: "product",
    entityId: id,
    details: `Updated ${body.title.trim()} (${status})`,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.archive")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const { id } = await context.params;
  await executeSql(`UPDATE products SET status = 'archived', purchasable = 0 WHERE id = ?`, [id]);
  await logAdminActivity({
    userId: staff.id,
    actorName: staff.name,
    action: "product.archived",
    entityType: "product",
    entityId: id,
    details: `Archived product ${id}`,
  });
  return NextResponse.json({ ok: true });
}
