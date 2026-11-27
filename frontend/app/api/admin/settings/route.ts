import { NextResponse } from "next/server";
import type { RowDataPacket } from "@backend/lib/postgres";
import { getSessionUser, listRecentActivity, logAdminActivity } from "@backend/lib/admin-auth";
import { executeSql, parseJsonValue, queryRows } from "@backend/lib/postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

  const [settingsRows, activity] = await Promise.all([
    queryRows<RowDataPacket>(`SELECT setting_key, setting_value, updated_at FROM site_settings`),
    listRecentActivity(100),
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    settings[row.setting_key] = parseJsonValue(row.setting_value, {});
  }

  return NextResponse.json({ settings, activity });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || !["super_admin", "content_editor"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    settingKey?: string;
    settingValue?: Record<string, unknown>;
  } | null;

  if (!body?.settingKey || !body.settingValue || typeof body.settingValue !== "object") {
    return NextResponse.json({ error: "Provide settingKey and settingValue." }, { status: 400 });
  }
  if (user.role === "content_editor" && body.settingKey !== "company_profile") {
    return NextResponse.json({ error: "Content editors can only update the company profile." }, { status: 403 });
  }

  await executeSql(
    `INSERT INTO site_settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON CONFLICT (setting_key) DO UPDATE
     SET setting_value = EXCLUDED.setting_value, updated_by = EXCLUDED.updated_by`,
    [body.settingKey, JSON.stringify(body.settingValue), user.id],
  );

  await logAdminActivity({
    userId: user.id,
    actorName: user.name,
    action: "settings.updated",
    entityType: "site_settings",
    entityId: body.settingKey,
    details: `Updated ${body.settingKey} settings`,
  });

  return NextResponse.json({ ok: true });
}
