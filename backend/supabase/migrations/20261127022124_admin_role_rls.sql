-- Admin database roles and RLS policies for the existing application roles.
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'yel_admin_super',
    'yel_admin_listings',
    'yel_admin_orders',
    'yel_admin_support',
    'yel_admin_content'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOINHERIT NOBYPASSRLS', role_name);
    END IF;
    EXECUTE format('ALTER ROLE %I NOLOGIN NOINHERIT NOBYPASSRLS', role_name);
  END LOOP;
END;
$$;

GRANT yel_admin_super, yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content
  TO postgres WITH INHERIT FALSE, SET TRUE;

REVOKE ALL ON SCHEMA yel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA yel FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA yel FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA yel TO
  yel_admin_super,
  yel_admin_listings,
  yel_admin_orders,
  yel_admin_support,
  yel_admin_content;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA yel TO yel_admin_super;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA yel TO yel_admin_super;

DO $$
DECLARE
  target record;
  command_name text;
  policy_name text;
BEGIN
  FOR target IN SELECT tablename FROM pg_tables WHERE schemaname = 'yel' LOOP
    EXECUTE format('ALTER TABLE yel.%I ENABLE ROW LEVEL SECURITY', target.tablename);
    policy_name := format('yel_admin_super_%s_all', target.tablename);
    EXECUTE format('DROP POLICY IF EXISTS %I ON yel.%I', policy_name, target.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON yel.%I FOR ALL TO yel_admin_super USING (true) WITH CHECK (true)',
      policy_name,
      target.tablename
    );
  END LOOP;

  FOR target IN
    SELECT role_name, table_name, commands
    FROM (VALUES
      ('yel_admin_listings', 'orders', 'SELECT'),
      ('yel_admin_listings', 'jobs', 'SELECT,INSERT,UPDATE'),
      ('yel_admin_listings', 'products', 'SELECT,INSERT,UPDATE'),
      ('yel_admin_listings', 'job_applications', 'SELECT'),
      ('yel_admin_listings', 'appointment_requests', 'SELECT'),
      ('yel_admin_listings', 'inquiries', 'SELECT'),
      ('yel_admin_listings', 'activity_log', 'SELECT,INSERT'),
      ('yel_admin_listings', 'site_settings', 'SELECT'),

      ('yel_admin_orders', 'orders', 'SELECT,UPDATE'),
      ('yel_admin_orders', 'order_items', 'SELECT'),
      ('yel_admin_orders', 'payments', 'SELECT,INSERT,UPDATE'),
      ('yel_admin_orders', 'customers', 'SELECT'),
      ('yel_admin_orders', 'order_status_events', 'INSERT'),
      ('yel_admin_orders', 'client_alerts', 'INSERT'),
      ('yel_admin_orders', 'products', 'SELECT'),
      ('yel_admin_orders', 'carts', 'SELECT'),
      ('yel_admin_orders', 'activity_log', 'SELECT,INSERT'),
      ('yel_admin_orders', 'site_settings', 'SELECT'),

      ('yel_admin_support', 'orders', 'SELECT'),
      ('yel_admin_support', 'order_items', 'SELECT'),
      ('yel_admin_support', 'payments', 'SELECT'),
      ('yel_admin_support', 'customers', 'SELECT'),
      ('yel_admin_support', 'jobs', 'SELECT,UPDATE'),
      ('yel_admin_support', 'products', 'SELECT'),
      ('yel_admin_support', 'job_applications', 'SELECT,UPDATE'),
      ('yel_admin_support', 'job_application_events', 'INSERT'),
      ('yel_admin_support', 'appointment_requests', 'SELECT,UPDATE'),
      ('yel_admin_support', 'inquiries', 'SELECT,INSERT,UPDATE'),
      ('yel_admin_support', 'activity_log', 'SELECT,INSERT'),
      ('yel_admin_support', 'site_settings', 'SELECT'),

      ('yel_admin_content', 'orders', 'SELECT'),
      ('yel_admin_content', 'jobs', 'SELECT'),
      ('yel_admin_content', 'products', 'SELECT'),
      ('yel_admin_content', 'job_applications', 'SELECT'),
      ('yel_admin_content', 'appointment_requests', 'SELECT'),
      ('yel_admin_content', 'inquiries', 'SELECT'),
      ('yel_admin_content', 'activity_log', 'SELECT,INSERT'),
      ('yel_admin_content', 'site_settings', 'SELECT')
    ) AS rules(role_name, table_name, commands)
  LOOP
    FOREACH command_name IN ARRAY string_to_array(target.commands, ',') LOOP
      policy_name := format(
        '%s_%s_%s',
        target.role_name,
        target.table_name,
        lower(command_name)
      );
      EXECUTE format('DROP POLICY IF EXISTS %I ON yel.%I', policy_name, target.table_name);

      IF command_name = 'SELECT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON yel.%I FOR SELECT TO %I USING (true)',
          policy_name,
          target.table_name,
          target.role_name
        );
      ELSIF command_name = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON yel.%I FOR INSERT TO %I WITH CHECK (true)',
          policy_name,
          target.table_name,
          target.role_name
        );
      ELSIF command_name = 'UPDATE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON yel.%I FOR UPDATE TO %I USING (true) WITH CHECK (true)',
          policy_name,
          target.table_name,
          target.role_name
        );
      ELSIF command_name = 'DELETE' THEN
        EXECUTE format(
          'CREATE POLICY %I ON yel.%I FOR DELETE TO %I USING (true)',
          policy_name,
          target.table_name,
          target.role_name
        );
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Every admin role can see dashboard aggregates and its own basic activity/settings.
GRANT SELECT (id, total_amount, payment_status, status, cancel_requested_at)
  ON yel.orders TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT SELECT (id, status, openings_total, openings_filled)
  ON yel.jobs TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT SELECT (id, status, division)
  ON yel.products TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT SELECT (id, status)
  ON yel.job_applications, yel.appointment_requests, yel.inquiries
  TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT SELECT (id, actor_name, action, entity_type, entity_id, details, created_at),
      INSERT (user_id, actor_name, action, entity_type, entity_id, details, metadata)
  ON yel.activity_log
  TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT USAGE, SELECT ON SEQUENCE yel.activity_log_id_seq
  TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
GRANT SELECT ON yel.site_settings
  TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;

GRANT SELECT (id), UPDATE (password_hash, totp_secret, totp_enabled)
  ON yel.admin_users
  TO yel_admin_listings, yel_admin_orders, yel_admin_support, yel_admin_content;
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'yel_admin_listings',
    'yel_admin_orders',
    'yel_admin_support',
    'yel_admin_content'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON yel.admin_users FOR SELECT TO %I USING (id = NULLIF(current_setting(''yel.admin_user_id'', true), '''')::bigint)',
      format('%s_admin_users_self_select', role_name),
      role_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON yel.admin_users FOR UPDATE TO %I USING (id = NULLIF(current_setting(''yel.admin_user_id'', true), '''')::bigint) WITH CHECK (id = NULLIF(current_setting(''yel.admin_user_id'', true), '''')::bigint)',
      format('%s_admin_users_self_update', role_name),
      role_name
    );
  END LOOP;
END;
$$;

-- Listings staff can manage catalog content but cannot read applicant details.
GRANT SELECT, INSERT, UPDATE ON yel.jobs, yel.products TO yel_admin_listings;
GRANT SELECT (job_id) ON yel.job_applications TO yel_admin_listings, yel_admin_content;
GRANT USAGE, SELECT ON SEQUENCE yel.jobs_id_seq TO yel_admin_listings;

-- Orders staff can process orders and payments, including inventory updates on sale items.
GRANT SELECT (
  id, order_number, status, payment_status, total_amount, currency,
  cancel_requested_at, cancel_reason, created_at, customer_id
), UPDATE (status, payment_status, updated_at)
  ON yel.orders TO yel_admin_orders;
GRANT SELECT (
  order_id, product_id, title, division, quantity, unit_amount, line_total, booking_details
) ON yel.order_items TO yel_admin_orders;
GRANT SELECT (
  id, order_id, provider, reference, provider_transaction_id, status, amount, created_at
) ON yel.payments TO yel_admin_orders;
GRANT INSERT (id, order_id, customer_id, provider, reference, amount, status, metadata),
      UPDATE (status, provider_transaction_id, metadata, updated_at)
  ON yel.payments TO yel_admin_orders;
GRANT SELECT (id, full_name, phone, email) ON yel.customers TO yel_admin_orders;
GRANT INSERT (id, order_id, customer_id, status, note) ON yel.order_status_events TO yel_admin_orders;
GRANT INSERT (id, customer_id, order_id, message) ON yel.client_alerts TO yel_admin_orders;
GRANT SELECT (id, listing_kind, stock_quantity, status),
      UPDATE (stock_quantity, status, purchasable, updated_at)
  ON yel.products TO yel_admin_orders;
GRANT SELECT (id, customer_id) ON yel.carts TO yel_admin_orders;
GRANT SELECT (cart_id, product_id) ON yel.cart_items TO yel_admin_orders;
GRANT DELETE ON yel.cart_items TO yel_admin_orders;
CREATE POLICY yel_admin_orders_products_update ON yel.products
  FOR UPDATE TO yel_admin_orders
  USING (listing_kind IN ('vehicle_sale', 'property_sale'))
  WITH CHECK (listing_kind IN ('vehicle_sale', 'property_sale'));
CREATE POLICY yel_admin_orders_cart_items_select ON yel.cart_items
  FOR SELECT TO yel_admin_orders
  USING (
    EXISTS (
      SELECT 1
      FROM yel.carts c
      JOIN yel.orders o ON o.customer_id = c.customer_id
      JOIN yel.order_items oi ON oi.order_id = o.id
      WHERE c.id = cart_items.cart_id
        AND oi.product_id = cart_items.product_id
        AND o.payment_status = 'paid'
    )
  );
CREATE POLICY yel_admin_orders_cart_items_delete ON yel.cart_items
  FOR DELETE TO yel_admin_orders
  USING (
    EXISTS (
      SELECT 1
      FROM yel.carts c
      JOIN yel.orders o ON o.customer_id = c.customer_id
      JOIN yel.order_items oi ON oi.order_id = o.id
      WHERE c.id = cart_items.cart_id
        AND oi.product_id = cart_items.product_id
        AND o.payment_status = 'paid'
    )
  );
GRANT USAGE, SELECT ON SEQUENCE yel.activity_log_id_seq TO yel_admin_orders;

-- Support staff can process applications, appointments, and inquiries.
GRANT SELECT (
  id, openings_total, openings_filled, status
), UPDATE (openings_filled, status)
  ON yel.jobs TO yel_admin_support;
GRANT SELECT (id, title, division, location, amount_kes, price_unit, status)
  ON yel.products TO yel_admin_support;
GRANT SELECT ON yel.job_applications TO yel_admin_support;
GRANT UPDATE (status, staff_notes, reviewed_by, updated_at)
  ON yel.job_applications TO yel_admin_support;
GRANT INSERT (job_application_id, status, note, updated_by_name)
  ON yel.job_application_events TO yel_admin_support;
GRANT SELECT ON yel.appointment_requests TO yel_admin_support;
GRANT UPDATE (status, staff_notes, updated_at)
  ON yel.appointment_requests TO yel_admin_support;
GRANT SELECT, INSERT ON yel.inquiries TO yel_admin_support;
GRANT UPDATE (status, staff_notes, assigned_to, notification_status, notification_error, updated_at)
  ON yel.inquiries TO yel_admin_support;
GRANT SELECT (
  id, order_number, status, payment_status, total_amount, currency,
  cancel_requested_at, cancel_reason, created_at, customer_id
) ON yel.orders TO yel_admin_support;
GRANT SELECT (
  order_id, product_id, title, division, quantity, unit_amount, line_total, booking_details
) ON yel.order_items TO yel_admin_support;
GRANT SELECT (
  id, order_id, provider, reference, provider_transaction_id, status, amount, created_at
) ON yel.payments TO yel_admin_support;
GRANT SELECT (id, full_name, phone) ON yel.customers TO yel_admin_support;
GRANT USAGE, SELECT ON SEQUENCE
  yel.activity_log_id_seq, yel.inquiries_id_seq, yel.job_application_events_id_seq
  TO yel_admin_support;

-- Content staff can edit company profile data but not operational business rules.
GRANT SELECT ON yel.jobs, yel.products TO yel_admin_content;
GRANT INSERT (setting_key, setting_value, updated_by),
      UPDATE (setting_value, updated_by)
  ON yel.site_settings TO yel_admin_content;
CREATE POLICY yel_admin_content_company_settings_insert ON yel.site_settings
  FOR INSERT TO yel_admin_content
  WITH CHECK (setting_key = 'company_profile');
CREATE POLICY yel_admin_content_company_settings_update ON yel.site_settings
  FOR UPDATE TO yel_admin_content
  USING (setting_key = 'company_profile')
  WITH CHECK (setting_key = 'company_profile');

ALTER FUNCTION yel.touch_updated_at() SET search_path = pg_catalog;
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;