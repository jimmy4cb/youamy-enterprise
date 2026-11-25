import bcrypt from "bcryptjs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

export type RowDataPacket = QueryResultRow;

export type ResultSetHeader = {
  affectedRows: number;
  insertId: number;
};

type QueryTuple<T> = [T];

export interface PoolConnection {
  query<T = RowDataPacket[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  execute<T = ResultSetHeader[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

type CompatiblePool = {
  query<T = RowDataPacket[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  execute<T = ResultSetHeader[]>(sql: string, values?: readonly unknown[]): Promise<QueryTuple<T>>;
  connect(): Promise<PoolConnection & { release(): void }>;
};

const ID_TABLES = new Set([
  "admin_users",
  "activity_log",
  "jobs",
  "job_applications",
  "job_application_events",
  "appointment_requests",
  "inquiries",
]);

declare global {
  // eslint-disable-next-line no-var
  var __youamyPostgresPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __youamyDbInitPromise: Promise<void> | undefined;
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

function toPostgresSql(sql: string): { text: string; ignoredConflict: boolean; returnsId: boolean } {
  let text = sql.trim().replace(/;$/, "");
  const ignoredConflict = /^\s*INSERT\s+IGNORE\s+INTO\b/i.test(text);
  text = text.replace(/\bUTC_TIMESTAMP(?:\(\d+\))?\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  text = text.replace(/\bUTC_TIMESTAMP\(\d+\)/gi, "CURRENT_TIMESTAMP");
  text = text.replace(/\bJSON_UNQUOTE\s*\(\s*JSON_EXTRACT\(\s*([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\s*,\s*'\$\.([a-zA-Z_][\w]*)'\s*\)\s*\)/gi, "($1.$2 ->> '$3')");
  if (ignoredConflict) text = text.replace(/^\s*INSERT\s+IGNORE\s+INTO\b/i, "INSERT INTO");

  const tableName = text.match(/^\s*INSERT\s+INTO\s+(?:[\w"]+\.)?([\w"]+)/i)?.[1]?.replace(/"/g, "").toLowerCase();
  const returnsId = Boolean(tableName && ID_TABLES.has(tableName) && !/\bRETURNING\b/i.test(text));
  if (ignoredConflict) text += " ON CONFLICT DO NOTHING";

  let parameter = 0;
  let quoted: "'" | '"' | "`" | null = null;
  let converted = "";
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      converted += character;
      if (character === quoted) {
        if (text[index + 1] === quoted) {
          converted += text[index + 1];
          index += 1;
        } else {
          quoted = null;
        }
      } else if (character === "\\" && quoted !== "'") {
        converted += text[index + 1] ?? "";
        index += 1;
      }
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quoted = character;
      converted += character === "`" ? '"' : character;
    } else if (character === "?") {
      parameter += 1;
      converted += `$${parameter}`;
    } else {
      converted += character;
    }
  }

  if (returnsId) converted += " RETURNING id";
  return { text: converted, ignoredConflict, returnsId };
}

function qualifyTables(sql: string): string {
  const tables = [
    "admin_users", "admin_sessions", "admin_pending_logins", "activity_log", "customers",
    "customer_sessions", "jobs", "job_applications", "job_application_events", "products",
    "carts", "cart_items", "saved_items", "orders", "order_items", "payments",
    "order_status_events", "client_alerts", "appointment_requests", "inquiries", "site_settings",
  ];
  const tablePattern = new RegExp(
    `\\b(FROM|JOIN|INTO|UPDATE|DELETE\\s+FROM)\\s+(?!yel\\.)(?:public\\.)?(${tables.join("|")})\\b`,
    "gi",
  );
  return sql.replace(tablePattern, (_match, clause: string, table: string) => `${clause} yel.${table}`);
}

function isReadQuery(sql: string): boolean {
  return /^\s*(SELECT|WITH)\b/i.test(sql);
}

async function runQuery<T>(
  client: Pick<PoolClient, "query">,
  sql: string,
  values: readonly unknown[] = [],
): Promise<QueryTuple<T>> {
  const prepared = toPostgresSql(qualifyTables(sql));
  const result = await client.query(prepared.text, values.map((value) =>
    typeof value === "boolean" ? Number(value) : value,
  ));
  if (isReadQuery(sql)) return [result.rows as T];

  const firstRow = result.rows[0] as { id?: number | string } | undefined;
  const metadata: ResultSetHeader = {
    affectedRows: result.rowCount ?? 0,
    insertId: firstRow?.id === undefined ? 0 : Number(firstRow.id),
  };
  return [metadata as T];
}

function createTransactionConnection(client: PoolClient): PoolConnection & { release(): void } {
  return {
    query: <T = RowDataPacket[]>(sql: string, values: readonly unknown[] = []) =>
      runQuery<T>(client, sql, values),
    execute: <T = ResultSetHeader[]>(sql: string, values: readonly unknown[] = []) =>
      runQuery<T>(client, sql, values),
    beginTransaction: async () => {
      await client.query("BEGIN");
    },
    commit: async () => {
      await client.query("COMMIT");
    },
    rollback: async () => {
      await client.query("ROLLBACK");
    },
    release: () => client.release(),
  };
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

export async function ensureDatabaseReady(): Promise<CompatiblePool> {
  const pool = getPostgresPool();
  if (!global.__youamyDbInitPromise) {
    global.__youamyDbInitPromise = (async () => {
      await pool.query("SELECT 1 FROM yel.admin_users LIMIT 1");
      const { rows } = await global.__youamyPostgresPool!.query(
        "SELECT id FROM yel.admin_users LIMIT 1",
      );
      if (rows.length === 0) {
        const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
        const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
        const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
        if (!email || !password) {
          throw new Error(
            "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before initializing an empty Supabase database.",
          );
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
        }
        if (password.length < 12) {
          throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
        }
        const passwordHash = await bcrypt.hash(password, 12);
        await global.__youamyPostgresPool!.query(
          `INSERT INTO yel.admin_users (name, email, password_hash, role, active)
           VALUES ($1, $2, $3, 'super_admin', 1)
           ON CONFLICT (email) DO NOTHING`,
          [name, email, passwordHash],
        );
      }
    })().catch((error) => {
      global.__youamyDbInitPromise = undefined;
      throw error;
    });
  }
  await global.__youamyDbInitPromise;
  return pool;
}

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
