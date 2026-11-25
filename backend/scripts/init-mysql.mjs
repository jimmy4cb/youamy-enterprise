import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

async function main() {
  const host = process.env.MYSQL_HOST;
  const port = Number(process.env.MYSQL_PORT || "3306");
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const database = process.env.MYSQL_DATABASE;
  if (!host || !user || password === undefined || !database) {
    throw new Error("Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_PORT must be a valid TCP port.");
  }

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

    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const dir = path.resolve(scriptDir, "../database/mysql");
    const schemaSql = fs.readFileSync(path.join(dir, "001_schema.sql"), "utf8");
    const seedSql = fs.readFileSync(path.join(dir, "002_seed.sql"), "utf8");

    await connection.query(schemaSql);
    await connection.query(seedSql);

    const [adminRows] = await connection.query("SELECT COUNT(*) AS count FROM admin_users");
    if ((adminRows[0]?.count ?? 0) === 0) {
      const name = process.env.ADMIN_BOOTSTRAP_NAME?.trim() || "Super Admin";
      const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
      const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
      if (!email || !adminPassword) {
        throw new Error(
          "Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD before initializing an empty database.",
        );
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("ADMIN_BOOTSTRAP_EMAIL must be a valid email address.");
      }
      if (adminPassword.length < 12) {
        throw new Error("ADMIN_BOOTSTRAP_PASSWORD must be at least 12 characters.");
      }
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

main().catch((error) => {
  console.error("Failed to initialize MySQL:", error);
  process.exit(1);
});
