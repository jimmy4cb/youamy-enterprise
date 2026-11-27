import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Online payments are unavailable. Submit your order and the admin team will arrange an in-person visit." },
    { status: 410 },
  );
}
