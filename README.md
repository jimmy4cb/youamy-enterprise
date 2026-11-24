# youamry-enterprise

## Admin authentication setup

Apply `backend/database/migrations/202611240003_admin_auth.sql` and `backend/database/migrations/202611240004_inquiries.sql` to the Supabase project before using the admin login and activity endpoint.

To create the first administrator, set `SUPABASE_BOOTSTRAP_ADMIN_EMAIL` and a unique password of at least 12 characters in the ignored `frontend/.env` file, then run:

```powershell
npm run admin:bootstrap
```

The command only works while both Supabase and the local SQLite admin-user table are empty. It creates a `super_admin` and a local ID mirror needed by the remaining SQLite-backed admin features. Remove the bootstrap variables from `frontend/.env` after success. The first sign-in will prompt for TOTP setup.
