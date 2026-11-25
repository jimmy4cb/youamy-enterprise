import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getCurrentCustomer } from "@backend/lib/customer-auth";
import { queryOne, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const customer = await getCurrentCustomer();
  if (!customer) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { id } = await context.params;

  const order = await queryOne<RowDataPacket>(
    `SELECT id, order_number, status, payment_status, total_amount, currency, created_at
     FROM orders WHERE id = ? AND customer_id = ? LIMIT 1`,
    [id, customer.id],
  );
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "paid") {
    return NextResponse.json({ error: "Receipt is available after payment is confirmed." }, { status: 409 });
  }

  const [items, payment] = await Promise.all([
    queryRows<RowDataPacket>(
      `SELECT title, quantity, unit_amount, line_total FROM order_items WHERE order_id = ?`,
      [id],
    ),
    queryOne<RowDataPacket>(
      `SELECT provider, provider_transaction_id, reference FROM payments WHERE order_id = ? AND status = 'successful' LIMIT 1`,
      [id],
    ),
  ]);

  const document = await PDFDocument.create();
  const page = document.addPage([595, 842]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({ x: 0, y: 745, width: 595, height: 97, color: rgb(0.043, 0.141, 0.278) });
  page.drawText("YOUAMY ENTERPRISES LIMITED", { x: 50, y: 798, size: 18, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Official Payment Receipt", { x: 50, y: 770, size: 12, font: regular, color: rgb(0.831, 0.655, 0.173) });

  page.drawText(`Order Number: ${order.order_number}`, { x: 50, y: 705, size: 12, font: bold, color: rgb(0.043, 0.141, 0.278) });
  page.drawText(`Client: ${customer.full_name} (${customer.phone || customer.email || ""})`, { x: 50, y: 685, size: 10.5, font: regular });
  page.drawText(`Date: ${new Date(order.created_at).toLocaleString("en-KE")}`, { x: 50, y: 667, size: 10.5, font: regular });
  if (payment) {
    page.drawText(
      `Payment: ${String(payment.provider).toUpperCase()} · Ref ${payment.provider_transaction_id || payment.reference}`,
      { x: 50, y: 649, size: 10.5, font: regular },
    );
  }

  page.drawLine({ start: { x: 50, y: 625 }, end: { x: 545, y: 625 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  page.drawText("Item", { x: 50, y: 605, size: 11, font: bold });
  page.drawText("Qty", { x: 350, y: 605, size: 11, font: bold });
  page.drawText("Amount (KES)", { x: 430, y: 605, size: 11, font: bold });

  let y = 580;
  for (const item of items) {
    page.drawText(String(item.title).slice(0, 48), { x: 50, y, size: 10.5, font: regular });
    page.drawText(String(item.quantity), { x: 355, y, size: 10.5, font: regular });
    page.drawText(`KES ${Number(item.line_total || item.unit_amount * item.quantity).toLocaleString("en-KE")}`, {
      x: 430, y, size: 10.5, font: regular,
    });
    y -= 24;
  }

  page.drawLine({ start: { x: 50, y: y - 4 }, end: { x: 545, y: y - 4 }, thickness: 1, color: rgb(0.85, 0.88, 0.92) });
  page.drawText(`TOTAL PAID: KES ${Number(order.total_amount).toLocaleString("en-KE")}`, {
    x: 50, y: y - 30, size: 13.5, font: bold, color: rgb(0.043, 0.141, 0.278),
  });
  page.drawText("Thank you for choosing Youamy Enterprises Limited · Mombasa / Nairobi Corridor, Kenya", {
    x: 50, y: 70, size: 9.5, font: regular, color: rgb(0.4, 0.45, 0.52),
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
