import crypto from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "./supabase/server";
import { syncAdminUserMirror, type AdminRole, type AdminUser } from "./admin-db";

export const SESSION_COOKIE = "yel_admin_session";
export const PENDING_COOKIE = "yel_admin_pending";

const rolePermissions: Record<AdminRole, readonly string[]> = {
  super_admin: ["*"],
  listings_admin: ["listings.read", "listings.edit", "listings.status", "listings.archive", "clients.limited"],
  orders_admin: ["orders.read", "orders.edit", "orders.refund", "clients.limited"],
  support_agent: ["enquiries.read", "enquiries.create", "enquiries.reply", "orders.read", "clients.limited"],
  content_editor: ["content.edit", "chatbot.edit"],
};

export function hasPermission(role: AdminRole, permission: string) {
  return rolePermissions[role]?.includes("*") || rolePermissions[role]?.includes(permission);
}

export function canAccessAdminSection(role: AdminRole, section: string) {
  if (role === "super_admin") return true;
  const sectionPermissions: Record<string, string> = {
    dashboard: "listings.read",
    listings: "listings.read",
    staff: "staff.read",
    orders: "orders.read",
    enquiries: "enquiries.read",
    content: "content.edit",
    settings: "settings.edit",
    activity: "activity.read",
  };
  return hasPermission(role, sectionPermissions[section] || "");
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  const supabase = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await supabase
    .from("admin_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (sessionError) throw sessionError;
  if (!session) return null;

  const { data: user, error: userError } = await supabase
    .from("admin_users")
    .select("id, name, email, role, totp_secret, active")
    .eq("id", session.user_id)
    .eq("active", true)
    .maybeSingle();
  if (userError) throw userError;
  if (
    !user ||
    !Number.isSafeInteger(user.id) ||
    typeof user.name !== "string" ||
    typeof user.email !== "string" ||
    typeof user.active !== "boolean" ||
    !["super_admin", "listings_admin", "orders_admin", "support_agent", "content_editor"].includes(user.role)
  ) {
    return null;
  }
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as AdminRole,
    totp_secret: user.totp_secret,
    active: user.active,
  } satisfies AdminUser;
  await syncAdminUserMirror(sessionUser);
  return sessionUser;
}

export function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function generateTotpSecret() {
  return crypto.randomBytes(20).toString("base64").replace(/[^A-Z2-7]/gi, "").toUpperCase().slice(0, 32);
}

function base32Decode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  let value = 0;
  for (const char of secret.replace(/[^A-Z2-7]/gi, "").toUpperCase()) {
    value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return Buffer.from(bytes);
}

export function verifyTotp(secret: string, code: string) {
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
