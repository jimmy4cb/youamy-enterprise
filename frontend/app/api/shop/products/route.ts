import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@backend/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim();
    const division = url.searchParams.get("division");
    const supabase = createSupabaseAdminClient();
    let requestQuery = supabase
      .from("products")
      .select("id,title,division,description,image_urls,amount_kes,status,booking_kind")
      .eq("purchasable", true)
      .eq("status", "available")
      .order("created_at", { ascending: false });
    if (query) requestQuery = requestQuery.ilike("title", `%${query}%`);
    if (division) requestQuery = requestQuery.eq("division", division);
    const { data, error } = await requestQuery;
    if (error) throw error;
    return NextResponse.json({ products: data });
  } catch (error) {
    console.error("Could not load products", error);
    return NextResponse.json({ error: "Products are temporarily unavailable." }, { status: 503 });
  }
}
