import { mkdir } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

async function bootstrapAdmin() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const name = process.env.SUPABASE_BOOTSTRAP_ADMIN_NAME?.trim() || "Super Admin";
  const email = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPABASE_BOOTSTRAP_ADMIN_PASSWORD;

  if (!url || !key || !email || !password) {
    throw new Error(
      "Set Supabase server credentials and SUPABASE_BOOTSTRAP_ADMIN_EMAIL/PASSWORD in frontend/.env before running this command.",
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("SUPABASE_BOOTSTRAP_ADMIN_EMAIL must be a valid email address.");
  }
  if (password.length < 12) {
    throw new Error("SUPABASE_BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existingUsers, error: existingUsersError } = await supabase
    .from("admin_users")
    .select("id")
    .limit(1);
  if (existingUsersError) throw existingUsersError;
  if (existingUsers.length > 0) {
    throw new Error("Supabase already has admin users; this one-time bootstrap only works on an empty table.");
  }

  const dataDirectory = path.join(process.cwd(), "data");
  await mkdir(dataDirectory, { recursive: true });
  const db = await open({
    filename: path.join(dataDirectory, "youamy-admin.sqlite"),
    driver: sqlite3.Database,
  });

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        totp_secret TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const localUsers = await db.get("SELECT COUNT(*) AS count FROM admin_users");
    if (localUsers.count > 0) {
      throw new Error("The local SQLite admin_users table is not empty; use a separate data migration.");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const { data: user, error: insertError } = await supabase
      .from("admin_users")
      .insert({
        name,
        email,
        password_hash: passwordHash,
        role: "super_admin",
        active: true,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    try {
      await db.run(
        `INSERT INTO admin_users (id, name, email, password_hash, role, active)
         VALUES (?, ?, ?, ?, 'super_admin', 1)`,
        [user.id, name, email, "!supabase-auth-only!"],
      );
    } catch (error) {
      const { error: rollbackError } = await supabase.from("admin_users").delete().eq("id", user.id);
      if (rollbackError) {
        console.error("Could not remove the Supabase account after local mirror failure:", rollbackError.message);
      }
      throw error;
    }
  } finally {
    await db.close();
  }

  console.log(`Created the initial Supabase super-admin account for ${email}.`);
  console.log("Remove SUPABASE_BOOTSTRAP_ADMIN_NAME/EMAIL/PASSWORD from frontend/.env.");
}

bootstrapAdmin().catch((error) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
