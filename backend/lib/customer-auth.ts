import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2/promise";
import { executeSql, queryOne, toMysqlDatetime, withTransaction } from "./mysql";

export const CUSTOMER_SESSION_COOKIE = "yel_client_session";

export type CustomerUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  loyalty_tier: "standard" | "corporate" | "vip";
  city: string;
};

interface CustomerRow extends RowDataPacket {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  loyalty_tier: "standard" | "corporate" | "vip";
  city: string;
  active: number;
}

export function normalizePhone(raw: string): string {
  const cleaned = raw.trim().replace(/[\s()-]/g, "");
  if (/^0[17]\d{8}$/.test(cleaned)) return `+254${cleaned.slice(1)}`;
  if (/^254[17]\d{8}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
}

export async function getCurrentCustomer(): Promise<CustomerUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const row = await queryOne<CustomerRow>(
    `SELECT c.id, c.full_name, c.email, c.phone, c.loyalty_tier, c.city, c.active
     FROM customer_sessions s
     JOIN customers c ON c.id = s.customer_id
     WHERE s.id = ? AND s.expires_at > UTC_TIMESTAMP(3) AND c.active = 1
     LIMIT 1`,
    [sessionId],
  );
  if (!row) return null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    loyalty_tier: row.loyalty_tier,
    city: row.city || "",
  };
}

export async function createCustomerSession(customerId: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = toMysqlDatetime(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
  await executeSql(`DELETE FROM customer_sessions WHERE expires_at <= UTC_TIMESTAMP(3)`);
  await executeSql(
    `INSERT INTO customer_sessions (id, customer_id, expires_at) VALUES (?, ?, ?)`,
    [sessionId, customerId, expiresAt],
  );
  return sessionId;
}

export async function registerCustomer(params: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  city?: string;
}): Promise<CustomerUser> {
  const email = params.email?.trim().toLowerCase() || null;
  const phone = params.phone?.trim() ? normalizePhone(params.phone) : null;
  if (!email && !phone) {
    throw new Error("Provide at least an email address or phone number.");
  }
  if (params.password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const passwordHash = await bcrypt.hash(params.password, 10);
  const customerId = crypto.randomUUID();

  await withTransaction(async (conn) => {
    if (email) {
      const [existingEmail] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM customers WHERE email = ? LIMIT 1`,
        [email],
      );
      if (existingEmail.length > 0) {
        throw new Error("An account already exists with this email address.");
      }
    }
    if (phone) {
      const [existingPhone] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM customers WHERE phone = ? LIMIT 1`,
        [phone],
      );
      if (existingPhone.length > 0) {
        throw new Error("An account already exists with this phone number.");
      }
    }

    await conn.execute(
      `INSERT INTO customers (id, full_name, email, phone, password_hash, loyalty_tier, city)
       VALUES (?, ?, ?, ?, ?, 'standard', ?)`,
      [customerId, params.fullName.trim(), email, phone, passwordHash, params.city?.trim() || ""],
    );
    await conn.execute(
      `INSERT INTO carts (id, customer_id) VALUES (?, ?)`,
      [crypto.randomUUID(), customerId],
    );
  });

  return {
    id: customerId,
    full_name: params.fullName.trim(),
    email,
    phone,
    loyalty_tier: "standard",
    city: params.city?.trim() || "",
  };
}

export async function authenticateCustomer(identifier: string, password: string): Promise<CustomerUser | null> {
  const trimmed = identifier.trim();
  const isEmail = trimmed.includes("@");
  const normalizedPhone = isEmail ? "" : normalizePhone(trimmed);

  const row = await queryOne<CustomerRow>(
    `SELECT id, full_name, email, phone, password_hash, loyalty_tier, city, active
     FROM customers
     WHERE (email = ? OR phone = ? OR phone = ?) AND active = 1
     LIMIT 1`,
    [trimmed.toLowerCase(), trimmed, normalizedPhone],
  );
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    loyalty_tier: row.loyalty_tier,
    city: row.city || "",
  };
}
