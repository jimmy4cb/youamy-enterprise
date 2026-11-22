import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "@backend/lib/admin-auth";
import { getAdminDatabase } from "@backend/lib/admin-db";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export async function GET() {
  const staff = await getSessionUser();
  if (!staff || !hasPermission(staff.role, "listings.read")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("products")
    .select("id,title,division,description,image_urls,amount_kes,status,purchasable,booking_kind")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(request: Request) {
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
  };
  if (!body.title?.trim() || !body.division?.trim() ||
    !Number.isSafeInteger(body.amount_kes) || (body.amount_kes || 0) <= 0 || (body.amount_kes || 0) > 100_000_000 ||
    !Array.isArray(body.image_urls) ||
    !["none", "car", "short_stay"].includes(body.booking_kind || "")) {
    return NextResponse.json({ error: "Enter a title, division, positive price, photo URL list and booking type." }, { status: 400 });
  }
  if (body.image_urls.some((url) => {
    try { return !["https:", "http:"].includes(new URL(url).protocol); } catch { return true; }
  })) return NextResponse.json({ error: "Photo URLs must be valid HTTP or HTTPS links." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("products").insert({
    title: body.title.trim(),
    division: body.division.trim(),
    description: body.description?.trim() || "",
    amount_kes: body.amount_kes,
    image_urls: body.image_urls,
    booking_kind: body.booking_kind,
    purchasable: true,
    status: "available",
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Could not add the product." }, { status: 500 });

  const db = await getAdminDatabase();
  await db.run(
    "INSERT INTO activity_log (user_id, action, details) VALUES (?, 'product.created', ?)",
    [staff.id, body.title.trim()],
  );
  return NextResponse.json({ id: data.id });
}
