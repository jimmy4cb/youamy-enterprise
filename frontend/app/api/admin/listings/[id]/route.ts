import { NextResponse } from "next/server";
import { getSessionUser } from "@backend/lib/admin-auth";

export async function PATCH() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  return NextResponse.json({ ok: true });
}
