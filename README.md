# youamry-enterprise

## Admin authentication setup

Apply `backend/database/migrations/202611240003_admin_auth.sql` and `backend/database/migrations/202611240004_inquiries.sql` to the Supabase project before using the admin login and activity endpoint.

### Create the first admin on Vercel

In Vercel, add these environment variables for **Production**:

- `SUPABASE_BOOTSTRAP_ADMIN_ON_BUILD=true`
- `SUPABASE_BOOTSTRAP_ADMIN_EMAIL` and `SUPABASE_BOOTSTRAP_ADMIN_PASSWORD` (use a unique password of at least 12 characters)
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (keep the secret key server-side; never use a `NEXT_PUBLIC_` prefix)

Redeploy Production. The build creates a `super_admin` only when `admin_users` is empty; if an admin already exists, it skips creation. The Supabase admin-auth and inquiries migrations must be applied first. After a successful deployment, remove the bootstrap flag and bootstrap credentials from Vercel, then redeploy. The first sign-in prompts for TOTP setup.

For local development, set the bootstrap email and password in the ignored `frontend/.env` file and run `npm run admin:bootstrap`.
