import { PDFDocument, StandardFonts } from "pdf-lib";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@backend/lib/supabase/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;
  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,order_number,status,payment_status,total_amount,currency,created_at,order_items(title,quantity,unit_amount)")
    .eq("id", id).eq("user_id", user.id).single();
  if (error || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "paid") return NextResponse.json({ error: "Receipt is available after payment is confirmed." }, { status: 409 });

  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawText("Youamy Enterprises Limited", { x: 54, y: 770, size: 20, font: bold });
  page.drawText("Payment receipt", { x: 54, y: 738, size: 14, font: regular });
  page.drawText(`Order: ${order.order_number}`, { x: 54, y: 700, size: 12, font: bold });
  page.drawText(`Date: ${new Date(order.created_at).toLocaleString("en-KE")}`, { x: 54, y: 678, size: 11, font: regular });
  page.drawText("Items", { x: 54, y: 635, size: 12, font: bold });
  let y = 610;
  for (const item of order.order_items || []) {
    page.drawText(`${item.title}  x${item.quantity}  KES ${item.unit_amount.toLocaleString("en-KE")}`, {
      x: 54, y, size: 11, font: regular,
    });
    y -= 22;
  }
  page.drawText(`Total paid: KES ${order.total_amount.toLocaleString("en-KE")}`, {
    x: 54, y: y - 12, size: 14, font: bold,
  });
  page.drawText("Thank you for choosing Youamy Enterprises Limited.", {
    x: 54, y: y - 48, size: 10, font: regular,
  });
  const pdf = await document.save();
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${order.order_number}-receipt.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
