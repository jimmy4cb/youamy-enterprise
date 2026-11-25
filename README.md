# Youamy Enterprises Limited — Web Platform & Admin Suite

Full-stack multi-division platform for **Youamy Enterprises Limited** (Gulf Recruitment, Auto Marketplace, Real Estate & Short Stays, Sanitation & Waste Management), built with **Next.js 15 App Router**, **React 19**, **TypeScript**, and **MySQL (`mysql2/promise`)**.

## Architecture

- **Frontend (`frontend/`)**: Public multi-division storefront, Gulf Job Portal with CV upload, Vehicle & Property showcase, interactive Leaflet map booking for sanitation/inspections, live Application/Appointment/Order Tracker, Direct Shop with Cart, Customer Account Portal (`/sign-in`, `/cart`, `/checkout`, `/orders`, `/saved`, `/alerts`, `/profile`), and Staff Admin Console (`/admin`, `/admin/login`).
- **Backend (`backend/`)**:
  - `backend/database/mysql/001_schema.sql`: 21-table InnoDB MySQL schema with foreign keys, status constraints, and audit logs.
  - `backend/database/mysql/002_seed.sql`: Idempotent starter catalog (GCC jobs, vehicles, real estate, sanitation packages, and business rules).
  - `backend/lib/mysql.ts`: Singleton connection pool + `ensureDatabaseReady()` automatic schema/seed bootstrap.
  - `backend/lib/business-logic.ts`: Transactional checkout (`checkout_key` idempotency, atomic stock locking, car/short-stay overlap conflict prevention, dynamic pricing, order status state machine with stock restoration, job placement slot synchronization, sanitation quote estimator, and admin analytics).
  - `backend/lib/admin-auth.ts` & `backend/lib/customer-auth.ts`: Scrypt/bcrypt password hashing, HTTP-only signed sessions (`yel_admin_session`, `yel_client_session`), RBAC role enforcement, and optional TOTP 2FA.

## MySQL Setup & Commands

1. Configure `frontend/.env.local` (copy from `frontend/.env.example`):

   ```env
   MYSQL_HOST=127.0.0.1
   MYSQL_PORT=3306
   MYSQL_USER=youamry_app
   MYSQL_PASSWORD=your-password
   MYSQL_DATABASE=youamry_enterprise
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   PAYMENT_SANDBOX_MODE=true
   ```

2. Initialize database schema, seed data, and starter accounts:

   ```bash
   npm install
   npm run db:init
   ```

3. Optionally bootstrap/update an administrator account via CLI:

   ```bash
   BOOTSTRAP_ADMIN_EMAIL=admin@youamyenterprises.com \
   BOOTSTRAP_ADMIN_PASSWORD='YourStrongPassword12!' \
   npm run admin:bootstrap
   ```

4. Run development or production build:

   ```bash
   npm run typecheck
   npm run build
   npm run start
   ```
