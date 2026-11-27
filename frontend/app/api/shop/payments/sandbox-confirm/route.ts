import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Payment simulation is unavailable. Payments are recorded by staff after an in-person visit." },
    { status: 410 },
  );
}
