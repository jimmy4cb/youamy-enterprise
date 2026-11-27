DO $$
DECLARE
  role_name text;
  policy_name text;
  self_check text := 'id = NULLIF((SELECT current_setting(''yel.admin_user_id'', true)), '''')::bigint';
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'yel_admin_listings',
    'yel_admin_orders',
    'yel_admin_support',
    'yel_admin_content'
  ] LOOP
    policy_name := role_name || '_admin_users_self_select';
    EXECUTE format('ALTER POLICY %I ON yel.admin_users USING (%s)', policy_name, self_check);

    policy_name := role_name || '_admin_users_self_update';
    EXECUTE format(
      'ALTER POLICY %I ON yel.admin_users USING (%s) WITH CHECK (%s)',
      policy_name,
      self_check,
      self_check
    );
  END LOOP;
END;
$$;
