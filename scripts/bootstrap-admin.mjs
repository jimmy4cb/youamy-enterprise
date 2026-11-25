import bcrypt from "bcryptjs";
import pg from "pg";

async function bootstrapAdmin() {
  const connectionString = process.env.SUPABASE_DB_URL;
  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!connectionString || !email || !password) {
    throw new Error("Set SUPABASE_DB_URL, ADMIN_BOOTSTRAP_EMAIL, and ADMIN_BOOTSTRAP_PASSWORD.");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("SUPABASE_DB_URL must be a PostgreSQL connection string.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
  }
  if (password.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });
  try {
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO yel.admin_users (name, email, password_hash, role, active)
       VALUES ($1, $2, $3, 'super_admin', 1)
       ON CONFLICT (email) DO UPDATE
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'super_admin', active = 1
       RETURNING id`,
      [name, email, hash],
    );
    if (!rows[0]) throw new Error("Supabase did not return the bootstrapped admin account.");
    console.log(`Super-admin account ready for ${email}.`);
  } finally {
    await pool.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
