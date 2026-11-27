import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "@backend/lib/postgres";
import { executeSql, queryOne, queryRows } from "./postgres";
import { bindDatabaseRoleForAdmin } from "./postgres/role-context";

export const SESSION_COOKIE = "yel_admin_session";
export const PENDING_COOKIE = "yel_admin_pending";

export type AdminRole =
  | "super_admin"
  | "listings_admin"
  | "orders_admin"
  | "support_agent"
  | "content_editor";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  totp_secret: string | null;
  totp_enabled: boolean;
  active: boolean;
};

const rolePermissions: Record<AdminRole, readonly string[]> = {
  super_admin: ["*"],
  listings_admin: ["listings.read", "listings.edit", "listings.status", "listings.archive", "clients.limited"],
  orders_admin: ["orders.read", "orders.edit", "orders.refund", "clients.limited"],
  support_agent: ["enquiries.read", "enquiries.create", "enquiries.reply", "orders.read", "clients.limited"],
  content_editor: ["content.edit", "chatbot.edit", "listings.read"],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  return rolePermissions[role]?.includes("*") || rolePermissions[role]?.includes(permission) || false;
}

export function canAccessAdminSection(role: AdminRole, section: string): boolean {
  if (role === "super_admin") return true;
  const sectionPermissions: Record<string, string> = {
    dashboard: "listings.read",
    listings: "listings.read",
    jobs: "listings.read",
    staff: "staff.read",
    orders: "orders.read",
    enquiries: "enquiries.read",
    appointments: "enquiries.read",
    applications: "enquiries.read",
    content: "content.edit",
    settings: "settings.edit",
    activity: "activity.read",
  };
  return hasPermission(role, sectionPermissions[section] || "");
}

interface SessionUserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  totp_secret: string | null;
  totp_enabled: number;
  active: number;
}

export async function getSessionUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const row = await queryOne<SessionUserRow>(
    `SELECT u.id, u.name, u.email, u.role, u.totp_secret, u.totp_enabled, u.active
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3) AND u.active = 1
     LIMIT 1`,
    [sessionId],
  );

  if (!row) return null;
  bindDatabaseRoleForAdmin(row.role, Number(row.id));
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    totp_secret: row.totp_secret,
    totp_enabled: Boolean(row.totp_enabled),
    active: Boolean(row.active),
  };
}

export async function logAdminActivity(params: {
  userId?: number | null;
  actorName?: string;
  action: string;
  entityType?: string;
  entityId?: string | number | null;
  details?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await executeSql(
      `INSERT INTO activity_log (user_id, actor_name, action, entity_type, entity_id, details, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        params.userId ?? null,
        params.actorName ?? "System",
        params.action,
        params.entityType ?? "system",
        params.entityId !== undefined && params.entityId !== null ? String(params.entityId) : null,
        (params.details ?? "").slice(0, 500),
        params.metadata ? JSON.stringify(params.metadata) : null,
      ],
    );
  } catch (err) {
    console.error("Failed to write activity_log:", err);
  }
}

export async function listRecentActivity(limit = 100) {
  return queryRows(
    `SELECT id, user_id, actor_name, action, entity_type, entity_id, details, metadata, created_at
     FROM activity_log
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [limit],
  );
}

export function createToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateTotpSecret(): string {
  return crypto.randomBytes(20).toString("base64").replace(/[^A-Z2-7]/gi, "").toUpperCase().slice(0, 32);
}

function base32Decode(secret: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/[^A-Z2-7]/gi, "").toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return Buffer.from(bytes);
}

export function verifyTotp(secret: string, code: string): boolean {
  const cleanCode = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;
  const key = base32Decode(secret);
  if (!key.length) return false;
  for (const drift of [-1, 0, 1]) {
    const counter = Math.floor(Date.now() / 30_000) + drift;
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const digest = crypto.createHmac("sha1", key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0xf;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const generated = (binary % 1_000_000).toString().padStart(6, "0");
    if (crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(cleanCode))) return true;
  }
  return false;
}
