import { createSupabaseAdminClient } from "./supabase/server";

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
  active: boolean;
};

type SqliteCompatDb = {
  get: <T = any>(sql: string, params?: any[]) => Promise<T | undefined>;
  all: <T = any>(sql: string, params?: any[]) => Promise<T[]>;
  run: (sql: string, params?: any[]) => Promise<{ lastID?: number; changes?: number }>;
  exec: (sql: string) => Promise<void>;
};

function parseTableName(sql: string): string {
  const match =
    sql.match(/\bFROM\s+(?:public\.)?([a-zA-Z0-9_]+)/i) ||
    sql.match(/\bINTO\s+(?:public\.)?([a-zA-Z0-9_]+)/i) ||
    sql.match(/\bUPDATE\s+(?:public\.)?([a-zA-Z0-9_]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function parseInsertData(sql: string, params: any[] = []): Record<string, any> {
  const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/i);
  if (!colsMatch) return {};
  const cols = colsMatch[1].split(",").map((c) => c.trim().replace(/["`]/g, ""));
  const data: Record<string, any> = {};
  cols.forEach((col, i) => {
    if (i < params.length) {
      data[col] = Buffer.isBuffer(params[i]) ? params[i].toString("base64") : params[i];
    }
  });
  return data;
}

function parseUpdateData(sql: string, params: any[] = []): { updates: Record<string, any>; whereVal: any } {
  const setMatch = sql.match(/\bSET\s+([\s\S]+?)\s+WHERE\b/i);
  const updates: Record<string, any> = {};
  if (!setMatch) return { updates, whereVal: params[params.length - 1] };

  const assignments = setMatch[1].split(",");
  let paramIdx = 0;

  for (const part of assignments) {
    const [rawCol, rawVal] = part.split("=").map((s) => s.trim());
    const col = rawCol.replace(/["`]/g, "");
    if (rawVal === "?") {
      updates[col] = params[paramIdx++];
    } else if (/CURRENT_TIMESTAMP|NOW\(\)/i.test(rawVal)) {
      updates[col] = new Date().toISOString();
    } else if (/^'.*'$/.test(rawVal)) {
      updates[col] = rawVal.slice(1, -1);
    } else if (!Number.isNaN(Number(rawVal))) {
      updates[col] = Number(rawVal);
    }
  }

  return { updates, whereVal: params[paramIdx] };
}

function parseWhereColumn(sql: string): string {
  const whereMatch = sql.match(/\bWHERE\s+(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*=/i);
  return whereMatch ? whereMatch[1] : "id";
}

export async function getAdminDatabase(): Promise<SqliteCompatDb> {
  const supabase = createSupabaseAdminClient();

  return {
    async exec() {
      // Schema creation is handled in Supabase migrations
    },

    async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
      const table = parseTableName(sql);
      if (!table) return [];

      let query = supabase.from(table).select("*");

      if (/\bWHERE\b/i.test(sql) && params.length > 0) {
        const whereCol = parseWhereColumn(sql);
        query = query.eq(whereCol, params[0]);
      }

      if (/ORDER\s+BY\s+created_at\s+DESC/i.test(sql)) {
        query = query.order("created_at", { ascending: false });
      } else if (/ORDER\s+BY\s+updated_at\s+DESC/i.test(sql)) {
        query = query.order("updated_at", { ascending: false });
      } else if (/ORDER\s+BY\s+id\s+DESC/i.test(sql)) {
        query = query.order("id", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as T[];
    },

    async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
      const table = parseTableName(sql);
      if (!table) return undefined;

      if (/COUNT\(\*\)/i.test(sql)) {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });
        if (error) throw error;
        return { count: count ?? 0 } as T;
      }

      let query = supabase.from(table).select("*");
      if (/\bWHERE\b/i.test(sql) && params.length > 0) {
        const whereCol = parseWhereColumn(sql);
        query = query.eq(whereCol, params[0]);
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return (data ?? undefined) as T | undefined;
    },

    async run(sql: string, params: any[] = []) {
      const table = parseTableName(sql);
      if (!table) return { changes: 0 };

      if (/^\s*INSERT/i.test(sql)) {
        const payload = parseInsertData(sql, params);
        const isIgnore = /OR\s+IGNORE/i.test(sql);

        if (isIgnore) {
          const conflictCol = Object.keys(payload)[0];
          const { data, error } = await supabase
            .from(table)
            .upsert(payload, { onConflict: conflictCol, ignoreDuplicates: true })
            .select("id")
            .maybeSingle();
          if (error) throw error;
          return { lastID: data?.id, changes: data ? 1 : 0 };
        }

        const { data, error } = await supabase
          .from(table)
          .insert(payload)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        return { lastID: data?.id, changes: 1 };
      }

      if (/^\s*UPDATE/i.test(sql)) {
        const { updates, whereVal } = parseUpdateData(sql, params);
        const whereCol = parseWhereColumn(sql);
        const { error } = await supabase
          .from(table)
          .update(updates)
          .eq(whereCol, whereVal);
        if (error) throw error;
        return { changes: 1 };
      }

      if (/^\s*DELETE/i.test(sql)) {
        const whereCol = parseWhereColumn(sql);
        const { error } = await supabase
          .from(table)
          .delete()
          .eq(whereCol, params[0]);
        if (error) throw error;
        return { changes: 1 };
      }

      return { changes: 0 };
    },
  };
}

export async function syncAdminUserMirror(user: AdminUser): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_users")
    .update({
      name: user.name,
      role: user.role,
      totp_secret: user.totp_secret,
      active: user.active,
    })
    .eq("email", user.email);

  if (error) {
    console.error("Failed to sync admin user:", error);
  }
}
