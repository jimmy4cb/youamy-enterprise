import bcrypt from "bcryptjs";
import type { RowDataPacket } from "./types";
import { getPostgresPool } from "./pool";

declare global {
  // eslint-disable-next-line no-var
  var __youamyDbInitPromise: Promise<void> | undefined;
}

export async function ensureDatabaseReady() {
  const pool = getPostgresPool();
  if (!global.__youamyDbInitPromise) {
    global.__youamyDbInitPromise = (async () => {
      await pool.query("SELECT 1 FROM yel.admin_users LIMIT 1");
      const { rows } = await global.__youamyPostgresPool!.query<RowDataPacket>(
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
