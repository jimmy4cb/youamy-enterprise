import { ensureDatabaseReady } from "./bootstrap";
import { getPostgresPool } from "./pool";
import type { PoolConnection, ResultSetHeader, RowDataPacket } from "./types";

export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const pool = await ensureDatabaseReady();
  const [rows] = await pool.query<T[]>(sql, params);
  return rows;
}

export async function queryOne<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await queryRows<T>(sql, params);
  return rows[0] ?? null;
}

export async function executeSql(
  sql: string,
  params: readonly unknown[] = [],
): Promise<ResultSetHeader> {
  const pool = await ensureDatabaseReady();
  const [result] = await pool.execute<ResultSetHeader>(sql, params);
  return result;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const pool = await ensureDatabaseReady();
  const conn = await pool.connect();
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

export function toPostgresDatetime(date = new Date()): string {
  return date.toISOString();
}
