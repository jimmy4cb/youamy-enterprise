# Supabase PostgreSQL setup

Use Supabase's **Transaction pooler** connection string as the server-only `SUPABASE_DB_URL` in Vercel and local development. Copy it from the selected project's Dashboard > **Connect**; do not construct the pooler hostname manually. Confirm the connection string and migration target belong to the same project. Direct database endpoints are IPv6-only by default and may not work from IPv4-only networks or serverless deployments.

After setting `SUPABASE_DB_URL` in `frontend/.env`, run `npm run db:check`. This performs read-only queries to verify the database connection and check for `yel.admin_users`; it does not apply migrations. For a fresh project, apply [`backend/supabase/migrations/20261127011201_yel_platform_baseline.sql`](backend/supabase/migrations/20261127011201_yel_platform_baseline.sql) as the baseline. Alternatively, apply [`backend/database/migrations/202611250001_platform_postgres.sql`](backend/database/migrations/202611250001_platform_postgres.sql) in the Supabase SQL Editor. These are equivalent baselines; apply only one.

The app currently connects through the server-side `pg` driver. The `SUPABASE_URL`, publishable key, secret key, and JWKS URL are not used by the app's database code; never expose the secret key in a `NEXT_PUBLIC_` variable. Copy the pooler URL from Supabase's Connect dialog rather than composing it manually.

Set `ADMIN_BOOTSTRAP_EMAIL` and a fresh, unique `ADMIN_BOOTSTRAP_PASSWORD` (at least 12 characters) in Vercel for first-admin creation. The first request creates the `super_admin` if the private `yel.admin_users` table is empty. Remove the bootstrap credentials after the first successful login and TOTP setup.

Set `NEXT_PUBLIC_SITE_URL` to the canonical deployed site URL for Flutterwave redirect links. M-Pesa, Flutterwave, Resend, and Twilio credentials are optional integrations; keep their keys server-only.

## Mapping existing catalog SQL

The app uses its private `yel` schema rather than the separate `public` tables in older SQL snippets:

- Jobs and applications map to `yel.jobs` and `yel.job_applications`.
- Vehicles, properties, and shop products share `yel.products`, differentiated by `division` and `listing_kind`.
- Sanitation bookings map to `yel.appointment_requests`; inquiries map to `yel.inquiries`.
- The current migration includes the matching catalog entries and adds the additional septic, skip-bin, inspection, and attestation products using the app's product format.

Do not also apply the older `public` table definitions: they create parallel data stores that the app does not query. Keep job applications and booking details private. In particular, policies such as `USING (true)` on public application or booking tables would expose personal data to every API visitor. This app handles public submissions and tracking through its server routes instead of direct public table access.

This creates a fresh application schema; it does not migrate existing MySQL or public-schema data. Export/import any records you need before switching production traffic. Never put the PostgreSQL connection string in a `NEXT_PUBLIC_` variable or commit it to source control.
