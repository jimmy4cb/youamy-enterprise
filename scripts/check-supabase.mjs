import pg from "pg";

async function checkSupabase() {
  const connectionString = process.env.SUPABASE_DB_URL?.trim();
  if (!connectionString) {
    throw new Error("SUPABASE_DB_URL is missing. Copy the Transaction pooler URI into frontend/.env.");
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) {
    throw new Error("SUPABASE_DB_URL must be a PostgreSQL connection string.");
  }
  try {
    const url = new URL(connectionString);
    if (!url.hostname || !url.username || !url.password) throw new Error();
  } catch {
    throw new Error("SUPABASE_DB_URL must include a valid database host, username, and password.");
  }

  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const { rows } = await pool.query(
      "SELECT current_database() AS database, to_regclass('yel.admin_users') IS NOT NULL AS app_schema_ready",
    );
    console.log(`Supabase database connection succeeded (${rows[0].database}).`);
    if (rows[0].app_schema_ready) {
      console.log("Application schema is present (yel.admin_users).");
    } else {
      console.log("Application schema is missing. For a fresh project only, apply exactly one documented baseline; review existing data before changing an existing database.");
    }
  } catch (error) {
    const code = error?.code;
    if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      throw new Error("The database host could not be resolved. Re-copy the Transaction pooler URI from the selected project.");
    }
    if (code === "ENETUNREACH") {
      throw new Error("The database host is unreachable from this network. Use the project's Transaction pooler URI.");
    }
    if (code === "28P01") {
      throw new Error("Database authentication failed. Verify the database password and percent-encode reserved characters.");
    }
    if (code) {
      throw new Error(`Supabase connection check failed (${code}). Verify the project, Transaction pooler URI, and database password.`);
    }
    throw new Error("Supabase connection check failed. Verify the project, Transaction pooler URI, and database password.");
  } finally {
    await pool.end();
  }
}

checkSupabase().catch((error) => {
  console.error(error instanceof Error ? error.message : "Supabase connection check failed.");
  process.exitCode = 1;
});
