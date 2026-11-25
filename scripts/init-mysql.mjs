import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

async function main() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER || "youamry_app";
  const password = process.env.MYSQL_PASSWORD ?? "YouamyMysql!2026";
  const database = process.env.MYSQL_DATABASE || "youamry_enterprise";

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    multipleStatements: true,
    timezone: "Z",
    charset: "utf8mb4",
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database.replace(/`/g, "")}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.changeUser({ database });

    const dir = path.resolve(process.cwd(), "backend/database/mysql");
    const schemaSql = fs.readFileSync(path.join(dir, "001_schema.sql"), "utf8");
    const seedSql = fs.readFileSync(path.join(dir, "002_seed.sql"), "utf8");

    await connection.query(schemaSql);
    await connection.query(seedSql);

    const [adminRows] = await connection.query("SELECT COUNT(*) AS count FROM admin_users");
    if ((adminRows[0]?.count ?? 0) === 0) {
      const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
      const email = (process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || "admin@youamyenterprises.com").toLowerCase();
      const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || "YouamyAdmin!2026";
      const hash = await bcrypt.hash(adminPassword, 12);
      await connection.execute(
        `INSERT INTO admin_users (name, email, password_hash, role, totp_enabled, active)
         VALUES (?, ?, ?, 'super_admin', 0, 1)`,
        [name, email, hash],
      );
      console.log(`Seeded super_admin: ${email}`);
    }

    const [custRows] = await connection.query("SELECT COUNT(*) AS count FROM customers");
    if ((custRows[0]?.count ?? 0) === 0) {
      const demoHash = await bcrypt.hash("ClientDemo!2026", 10);
      const demoId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      await connection.execute(
        `INSERT IGNORE INTO customers (id, full_name, email, phone, password_hash, loyalty_tier, city)
         VALUES (?, 'Amina Hassan', 'client@youamyenterprises.com', '+254712345678', ?, 'corporate', 'Mombasa')`,
        [demoId, demoHash],
      );
      await connection.execute(
        `INSERT IGNORE INTO carts (id, customer_id) VALUES (?, ?)`,
        [crypto.randomUUID(), demoId],
      );
      console.log("Seeded demo client: client@youamyenterprises.com");
    }

    const [tables] = await connection.query("SHOW TABLES");
    console.log(`MySQL database '${database}' initialized with ${tables.length} tables.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Failed to initialize MySQL:", err);
  process.exit(1);
});
