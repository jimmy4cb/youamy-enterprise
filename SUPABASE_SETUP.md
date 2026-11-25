# Supabase PostgreSQL setup

Use Supabase's **Transaction pooler** connection string as the server-only `SUPABASE_DB_URL` in Vercel. Apply [`backend/database/migrations/202611250001_platform_postgres.sql`](backend/database/migrations/202611250001_platform_postgres.sql) in the Supabase SQL Editor before deploying.

Set `ADMIN_BOOTSTRAP_EMAIL` and a fresh, unique `ADMIN_BOOTSTRAP_PASSWORD` (at least 12 characters) in Vercel for first-admin creation. The first request creates the `super_admin` if the private `yel.admin_users` table is empty. Remove the bootstrap credentials after the first successful login and TOTP setup.

## Mapping existing catalog SQL

The app uses its private `yel` schema rather than the separate `public` tables in older SQL snippets:

- Jobs and applications map to `yel.jobs` and `yel.job_applications`.
- Vehicles, properties, and shop products share `yel.products`, differentiated by `division` and `listing_kind`.
- Sanitation bookings map to `yel.appointment_requests`; inquiries map to `yel.inquiries`.
- The current migration includes the matching catalog entries and adds the additional septic, skip-bin, inspection, and attestation products using the app's product format.

Do not also apply the older `public` table definitions: they create parallel data stores that the app does not query. Keep job applications and booking details private. In particular, policies such as `USING (true)` on public application or booking tables would expose personal data to every API visitor. This app handles public submissions and tracking through its server routes instead of direct public table access.

This creates a fresh application schema; it does not migrate existing MySQL or public-schema data. Export/import any records you need before switching production traffic. Never put the PostgreSQL connection string in a `NEXT_PUBLIC_` variable or commit it to source control.
