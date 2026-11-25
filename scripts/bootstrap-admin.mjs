import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

async function bootstrapAdmin() {
  const isVercelBuild = process.argv.includes("--vercel-build");
  if (isVercelBuild && (process.env.VERCEL !== "1" || process.env.SUPABASE_BOOTSTRAP_ADMIN_ON_BUILD !== "true")) {
    console.log("Admin bootstrap skipped; it is not enabled for this Vercel build.");
    return;
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const name = process.env.SUPABASE_BOOTSTRAP_ADMIN_NAME?.trim() || "Super Admin";
  const email = process.env.SUPABASE_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPABASE_BOOTSTRAP_ADMIN_PASSWORD;

  if (!url || !key || !email || !password) {
    throw new Error(
      "Set Supabase server credentials and SUPABASE_BOOTSTRAP_ADMIN_EMAIL/PASSWORD before running this command.",
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
    console.log("Admin bootstrap skipped; Supabase already has an admin account.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const { error: insertError } = await supabase.from("admin_users").insert({
    name,
    email,
    password_hash: passwordHash,
    role: "super_admin",
    active: true,
  });
  if (insertError?.code === "23505") {
    console.log("Admin bootstrap skipped; an admin account was created during this build.");
    return;
  }
  if (insertError) throw insertError;

  console.log(`Created the initial Supabase super-admin account for ${email}.`);
  console.log("Remove SUPABASE_BOOTSTRAP_ADMIN_ON_BUILD and the bootstrap credentials after deployment.");
}

bootstrapAdmin().catch((error) => {
  console.error("Admin bootstrap failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
