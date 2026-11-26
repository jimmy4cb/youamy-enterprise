import type { Pool, PoolClient } from "pg";
import type { PoolConnection, QueryTuple, ResultSetHeader, RowDataPacket } from "./types";

const ID_TABLES = new Set([
  "admin_users",
  "activity_log",
  "jobs",
  "job_applications",
  "job_application_events",
  "appointment_requests",
  "inquiries",
]);

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

export async function runQuery<T>(
  client: Pick<Pool | PoolClient, "query">,
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

export function createTransactionConnection(client: PoolClient): PoolConnection & { release(): void } {
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
