import { Pool } from "pg";
import { createTransactionConnection, runQuery } from "./sql-compat";
import type { CompatiblePool, ResultSetHeader, RowDataPacket } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __youamyPostgresPool: Pool | undefined;
}

function getConnectionString(): string {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error(
      "Set SUPABASE_DB_URL to the PostgreSQL connection string from your Supabase project's Connect dialog.",
    );
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("SUPABASE_DB_URL must be a PostgreSQL connection string.");
  }
  return connectionString;
}

export function getPostgresPool(): CompatiblePool {
  if (!global.__youamyPostgresPool) {
    global.__youamyPostgresPool = new Pool({
      connectionString: getConnectionString(),
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  const pool = global.__youamyPostgresPool;
  return {
    query: <T = RowDataPacket[]>(sql: string, values: readonly unknown[] = []) =>
      runQuery<T>(pool, sql, values),
    execute: <T = ResultSetHeader[]>(sql: string, values: readonly unknown[] = []) =>
      runQuery<T>(pool, sql, values),
    connect: async () => createTransactionConnection(await pool.connect()),
  };
}
