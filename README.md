# Youamy Enterprises Limited — Web Platform & Admin Suite

Full-stack multi-division platform for **Youamy Enterprises Limited** (Gulf Recruitment, Auto Marketplace, Real Estate & Short Stays, Sanitation & Waste Management), built with **Next.js 15 App Router**, **React 19**, **TypeScript**, and Supabase-hosted PostgreSQL.

## Architecture

- **Frontend (`frontend/`)**: Public multi-division storefront, Gulf Job Portal with CV upload, Vehicle & Property showcase, interactive Leaflet map booking for sanitation/inspections, live Application/Appointment/Order Tracker, Direct Shop with Cart, Customer Account Portal (`/sign-in`, `/cart`, `/checkout`, `/orders`, `/saved`, `/alerts`, `/profile`), and Staff Admin Console (`/admin`, `/admin/login`).
- **Backend (`backend/`)**:
  - `backend/supabase/migrations/20261127011201_yel_platform_baseline.sql`: Supabase baseline for the private `yel` schema, indexes, RLS lockdown, and starter catalog.
  - `backend/database/migrations/202611250001_platform_postgres.sql`: equivalent PostgreSQL baseline for manual SQL-editor use.
  - `backend/lib/postgres.ts`: compatibility entry point for the Supabase PostgreSQL adapter; implementation is split across `backend/lib/postgres/` for SQL compatibility, pooling, bootstrap, and query/transaction helpers.
  - `backend/lib/business-logic.ts`: compatibility entry point for domain services, split into booking, order, job-application, and admin-metrics modules under `backend/lib/`.
  - `backend/lib/admin-auth.ts` & `backend/lib/customer-auth.ts`: bcrypt password hashing, database-backed HTTP-only sessions (`yel_admin_session`, `yel_client_session`), RBAC role enforcement, and optional TOTP 2FA.

## Supabase PostgreSQL Setup

1. In Supabase, open **Connect** and copy the PostgreSQL connection string for the **Transaction pooler**. Put it in `frontend/.env` as `SUPABASE_DB_URL` (do not commit the value). Direct database endpoints are IPv6-only by default; use the transaction pooler for local IPv4-only environments and Vercel:

   ```env
   SUPABASE_DB_URL=postgresql://...
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ADMIN_BOOTSTRAP_EMAIL=
   ADMIN_BOOTSTRAP_PASSWORD=
   PAYMENT_SANDBOX_MODE=true
   ```

   The connection string contains your database password. Keep it server-only and never use a `NEXT_PUBLIC_` prefix.

   Verify connectivity and the application table with `npm run db:check`. This check is read-only and does not apply migrations.

2. Apply [`20261127011201_yel_platform_baseline.sql`](backend/supabase/migrations/20261127011201_yel_platform_baseline.sql) to a fresh Supabase project using the Supabase SQL Editor. Alternatively, run the equivalent [`202611250001_platform_postgres.sql`](backend/database/migrations/202611250001_platform_postgres.sql); apply only one baseline. This creates the private `yel` schema and seeds the catalog while leaving existing `public` tables untouched. It does not copy existing MySQL or Supabase data, so export/import any records you need before switching production traffic.

3. Configure the same `SUPABASE_DB_URL` in Vercel Production. Set `ADMIN_BOOTSTRAP_EMAIL` and a fresh, unique `ADMIN_BOOTSTRAP_PASSWORD` of at least 12 characters. The first server request creates the initial `super_admin` if `yel.admin_users` is empty.

4. Visit `/admin/login` and complete the TOTP setup. After successful setup, remove `ADMIN_BOOTSTRAP_EMAIL` and `ADMIN_BOOTSTRAP_PASSWORD` from Vercel. Keep `SUPABASE_DB_URL`.

For local development, set these values in the ignored `frontend/.env` file and run:

```powershell
npm run dev
```

Run `npm run typecheck` and `npm run build` to validate the app.
