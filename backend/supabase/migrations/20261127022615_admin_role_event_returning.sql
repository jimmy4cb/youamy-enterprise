GRANT SELECT (id) ON yel.job_application_events TO yel_admin_support;

CREATE POLICY yel_admin_support_job_application_events_select
  ON yel.job_application_events
  FOR SELECT TO yel_admin_support
  USING (true);
