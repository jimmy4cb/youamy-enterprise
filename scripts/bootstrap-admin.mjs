import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

async function bootstrapAdmin() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER || "youamry_app";
  const password = process.env.MYSQL_PASSWORD ?? "YouamyMysql!2026";
  const database = process.env.MYSQL_DATABASE || "youamry_enterprise";

  const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!email || !adminPassword) {
    throw new Error("Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD in frontend/.env.local.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
  }
  if (adminPassword.length < 12) {
    throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
  }

  const connection = await mysql.createConnection({ host, port, user, password, database });
  try {
    const hash = await bcrypt.hash(adminPassword, 12);
    await connection.execute(
      `INSERT INTO admin_users (name, email, password_hash, role, totp_enabled, active)
       VALUES (?, ?, ?, 'super_admin', 0, 1)
       ON DUPLICATE KEY UPDATE name = VALUES(name), password_hash = VALUES(password_hash), role = 'super_admin', active = 1`,
      [name, email, hash],
    );
    console.log(`Super-admin account ready for ${email}.`);
  } finally {
    await connection.end();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
