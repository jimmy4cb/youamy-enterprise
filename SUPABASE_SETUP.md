# Supabase customer checkout setup

The storefront intentionally shows only products marked purchasable with a confirmed KES price. Existing “Sample” listings are enquiry-only; they are not turned into chargeable products.

## Database and authentication

1. Create a Supabase project and copy `frontend/.env.example` to `frontend/.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. The service-role key is server-only; never add a `NEXT_PUBLIC_` prefix to it.
3. Run `backend/database/migrations/202611220001_client_journey.sql` in the Supabase SQL Editor (or with the Supabase CLI).
4. In Supabase Authentication, enable Google OAuth and configure the provider credentials. Add `<site-url>/auth/callback` to the allowed redirect URLs.
5. Enable email OTP and phone/SMS OTP, configure an SMS provider, and make the email template expose the six-digit `{{ .Token }}` code. Use HTTPS for deployed sites.
6. Add confirmed products in `/admin` → **Shop products**. Enter the actual KES price and public image URLs. Do not list sample or unconfirmed prices as purchasable.

Profiles and carts are initialized after Supabase creates a user. RLS policies scope client reads and writes to `auth.uid()`. Order and payment writes are server-only. The checkout RPC snapshots current product prices and uses a unique `(user_id, checkout_key)` so repeated submissions for one cart return the same order. A partial unique index allows only one pending payment attempt per order. Failed callbacks permit a fresh, uniquely referenced retry; successful callbacks lock and mark the order exactly once.

## Payment gateways

### M-Pesa

1. Use Daraja sandbox credentials first: set `MPESA_ENV=sandbox`, consumer key/secret, shortcode and passkey.
2. Publish the app to a public HTTPS URL and set `MPESA_CALLBACK_URL` to `<site-url>/api/shop/payments/webhook/mpesa`.
3. Test successful, cancelled, and timed-out STK prompts before switching to live Daraja credentials.

The callback is not trusted by itself: the server queries Daraja using the stored CheckoutRequestID, verifies the amount against the order, then calls the database confirmation function.

### Flutterwave cards

1. Set the server-only `FLW_SECRET_KEY` and `FLW_WEBHOOK_SECRET_HASH`.
2. Configure Flutterwave’s webhook to `<site-url>/api/shop/payments/webhook/flutterwave`.
3. Set the provider to KES and test successful and failed payments in the provider’s test environment.

The webhook validates Flutterwave’s `verif-hash`, fetches the transaction from Flutterwave’s verification API, and checks its status, reference, currency, and amount before confirmation. The browser return URL never marks an order paid.

Order email/SMS notifications use Resend and Twilio when their credentials are set. Inquiry forms in the admin dashboard save records to the local admin database and send a Resend email to `INQUIRIES_EMAIL`; if email delivery is not configured or fails, the saved record remains visible with its delivery status and an explicit warning. Without order notification credentials, order state and in-app alerts still work, but external delivery is not sent.

## Cancellation policy and receipts

Clients can request cancellation from a paid order. A staff member must approve it and update the order status. Receipts are generated as PDFs only after payment is confirmed. Store product and payment secrets in the hosting provider’s environment settings, not in source control.

## Source folders

- `frontend/` contains the Next.js App Router, UI, browser-only clients, styles and static assets.
- `backend/` contains server-only services and the database migration.
- API route handlers stay in `frontend/app/api` because this is one Next.js runtime; they use the backend services without exposing server secrets to browser code.

## Manual acceptance checks

- Add a confirmed product as a guest, reload, and confirm it remains in `/cart`.
- Continue to checkout; confirm sign-in returns to checkout and merges the browser cart with the account cart.
- Use sandbox credentials to test a failed payment, then retry with a different gateway or attempt. Confirm it reuses the order and gets a new payment reference.
- Replay a successful webhook. Confirm the unique provider transaction and database order lock leave one payment, one Placed transition, and one alert.
- Sign in as a second client and request the first client’s `/orders/<id>` URL. The API must return 404 and no order data.
- Verify payment and order mutations through the provider callback and admin status endpoint only; browser requests cannot write order/payment tables under RLS.
