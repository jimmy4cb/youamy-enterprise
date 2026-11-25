import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mysql, { type Pool, type PoolConnection, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var __youamyMysqlPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __youamyDbInitPromise: Promise<void> | undefined;
}

function resolveEnvConfig() {
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;

  if (!host || !user || password === undefined || !database) {
    throw new Error("Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }

  return { host, port, user, password, database };
}

export function getMysqlPool(): Pool {
  if (!global.__youamyMysqlPool) {
    const cfg = resolveEnvConfig();
    global.__youamyMysqlPool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      waitForConnections: true,
      connectionLimit: 12,
      queueLimit: 0,
      timezone: "Z",
      charset: "utf8mb4",
      multipleStatements: true,
    });
  }
  return global.__youamyMysqlPool;
}

function findMigrationDir(): string {
  const candidates = [
    path.resolve(process.cwd(), "backend/database/mysql"),
    path.resolve(process.cwd(), "../backend/database/mysql"),
    "/home/user/youamry-enterprise/backend/database/mysql",
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "001_schema.sql"))) return dir;
  }
  throw new Error("Could not locate backend/database/mysql SQL files.");
}

async function runSqlBootstrap(pool: Pool) {
  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES LIKE 'admin_users'");
  if (tables.length === 0) {
    const dir = findMigrationDir();
    const schemaSql = fs.readFileSync(path.join(dir, "001_schema.sql"), "utf8");
    const seedSql = fs.readFileSync(path.join(dir, "002_seed.sql"), "utf8");
    await pool.query(schemaSql);
    await pool.query(seedSql);
  }

  const [adminRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM admin_users");
  if ((adminRows[0]?.count ?? 0) === 0) {
    const adminName = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
    const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
    if (!adminEmail || !adminPassword) {
      throw new Error(
        "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before initializing an empty database.",
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
    }
    if (adminPassword.length < 12) {
      throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
    }
    const hash = await bcrypt.hash(adminPassword, 12);
    await pool.execute(
      `INSERT IGNORE INTO admin_users (name, email, password_hash, role, totp_enabled, active)
       VALUES (?, ?, ?, 'super_admin', 0, 1)`,
      [adminName, adminEmail, hash],
    );
    await pool.execute(
      `INSERT IGNORE INTO activity_log (actor_name, action, entity_type, details)
       VALUES ('System', 'system.bootstrap', 'admin_user', ?)`,
      [`Created initial super_admin (${adminEmail})`],
    );
  }

  const [custRows] = await pool.query<RowDataPacket[]>("SELECT COUNT(*) AS count FROM customers");
  if ((custRows[0]?.count ?? 0) === 0) {
    const demoHash = await bcrypt.hash("ClientDemo!2026", 10);
    const demoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await pool.execute(
      `INSERT IGNORE INTO customers (id, full_name, email, phone, password_hash, loyalty_tier, city)
       VALUES (?, 'Amina Hassan', 'client@youamyenterprises.com', '+254712345678', ?, 'corporate', 'Mombasa')`,
      [demoId, demoHash],
    );
    await pool.execute(
      `INSERT IGNORE INTO carts (id, customer_id) VALUES (?, ?)`,
      [crypto.randomUUID(), demoId],
    );
  }
}

export async function ensureDatabaseReady(): Promise<Pool> {
  const pool = getMysqlPool();
  if (!global.__youamyDbInitPromise) {
    global.__youamyDbInitPromise = runSqlBootstrap(pool).catch((err) => {
      global.__youamyDbInitPromise = undefined;
      throw err;
    });
  }
  await global.__youamyDbInitPromise;
  return pool;
}

export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const pool = await ensureDatabaseReady();
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
}

export async function executeSql(
  sql: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> {
  const pool = await ensureDatabaseReady();
  const [result] = await pool.execute<ResultSetHeader>(sql, params as never);
  return result;
}

export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const pool = await ensureDatabaseReady();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") return value as T;
  return fallback;
}

export function toMysqlDatetime(date = new Date()): string {
  return date.toISOString().slice(0, 23).replace("T", " ");
}
