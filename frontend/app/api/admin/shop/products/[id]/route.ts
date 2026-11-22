import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.edit")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const body = await request.json() as {
    title?: string;
    division?: string;
    description?: string;
    amount_kes?: number;
    image_urls?: string[];
    booking_kind?: string;
    status?: string;
  };
  if (!body.title?.trim() || !body.division?.trim() ||
    !Number.isSafeInteger(body.amount_kes) || (body.amount_kes || 0) <= 0 || (body.amount_kes || 0) > 100_000_000 ||
    !Array.isArray(body.image_urls) ||
    !["none", "car", "short_stay"].includes(body.booking_kind || "") ||
    !["available", "sold", "booked", "unavailable"].includes(body.status || "")) {
    return NextResponse.json({ error: "Product details or availability status are invalid." }, { status: 400 });
  }
  if (body.image_urls.some((url) => {
    try { return !["https:", "http:"].includes(new URL(url).protocol); } catch { return true; }
  })) return NextResponse.json({ error: "Photo URLs must be valid HTTP or HTTPS links." }, { status: 400 });

  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("products").update({
    title: body.title.trim(),
    division: body.division.trim(),
    description: body.description?.trim() || "",
    amount_kes: body.amount_kes,
    image_urls: body.image_urls,
    booking_kind: body.booking_kind,
    status: body.status,
    purchasable: body.status === "available",
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update the product." }, { status: 500 });
  const db = await getAdminDatabase();
  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'product.updated', ?)",
    [staff.id, `${id}: ${body.status}`],
  );
  return NextResponse.json({ ok: true });
}
