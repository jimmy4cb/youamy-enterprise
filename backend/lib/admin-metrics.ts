import type { RowDataPacket } from "./postgres";
import { queryOne, queryRows } from "./postgres";

export async function getAdminOverviewMetrics() {
  const [
    revenueRow,
    ordersCounts,
    jobsCounts,
    productCounts,
    appsCounts,
    appointmentsCounts,
    inquiriesCounts,
    recentActivity,
  ] = await Promise.all([
    queryOne<RowDataPacket>(
      `SELECT COALESCE(SUM(total_amount), 0) AS paid_revenue, COUNT(id) AS paid_orders
       FROM orders WHERE payment_status = 'paid'`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_orders,
              SUM(CASE WHEN status = 'Placed' OR status = 'Confirmed' OR status = 'In progress' THEN 1 ELSE 0 END) AS active_orders,
              SUM(CASE WHEN cancel_requested_at IS NOT NULL AND status NOT IN ('Cancelled', 'Completed') THEN 1 ELSE 0 END) AS cancel_requests
       FROM orders`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_jobs,
              SUM(CASE WHEN status = 'Published' THEN 1 ELSE 0 END) AS active_jobs,
              COALESCE(SUM(CASE WHEN status = 'Published' THEN GREATEST(0, openings_total - openings_filled) ELSE 0 END), 0) AS remaining_slots
       FROM jobs`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_products,
              SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_products,
              SUM(CASE WHEN division = 'Vehicles' AND status = 'available' THEN 1 ELSE 0 END) AS vehicles_count,
              SUM(CASE WHEN division = 'Real Estate' AND status = 'available' THEN 1 ELSE 0 END) AS properties_count
       FROM products WHERE status <> 'archived'`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_applications,
              SUM(CASE WHEN status = 'New' THEN 1 ELSE 0 END) AS new_applications,
              SUM(CASE WHEN status = 'Shortlisted' OR status = 'Visa Processing' THEN 1 ELSE 0 END) AS in_pipeline,
              SUM(CASE WHEN status = 'Placed' THEN 1 ELSE 0 END) AS placed_count
       FROM job_applications`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_appointments,
              SUM(CASE WHEN status = 'Requested' THEN 1 ELSE 0 END) AS pending_appointments
       FROM appointment_requests`,
    ),
    queryOne<RowDataPacket>(
      `SELECT COUNT(id) AS total_inquiries,
              SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) AS unread_inquiries
       FROM inquiries`,
    ),
    queryRows<RowDataPacket>(
      `SELECT id, actor_name, action, entity_type, entity_id, details, created_at
       FROM activity_log ORDER BY created_at DESC, id DESC LIMIT 12`,
    ),
  ]);

  return {
    revenueKes: Number(revenueRow?.paid_revenue || 0),
    paidOrders: Number(revenueRow?.paid_orders || 0),
    totalOrders: Number(ordersCounts?.total_orders || 0),
    activeOrders: Number(ordersCounts?.active_orders || 0),
    cancelRequests: Number(ordersCounts?.cancel_requests || 0),
    totalJobs: Number(jobsCounts?.total_jobs || 0),
    activeJobs: Number(jobsCounts?.active_jobs || 0),
    remainingJobSlots: Number(jobsCounts?.remaining_slots || 0),
    totalProducts: Number(productCounts?.total_products || 0),
    availableProducts: Number(productCounts?.available_products || 0),
    vehiclesCount: Number(productCounts?.vehicles_count || 0),
    propertiesCount: Number(productCounts?.properties_count || 0),
    totalApplications: Number(appsCounts?.total_applications || 0),
    newApplications: Number(appsCounts?.new_applications || 0),
    pipelineApplications: Number(appsCounts?.in_pipeline || 0),
    placedApplications: Number(appsCounts?.placed_count || 0),
    totalAppointments: Number(appointmentsCounts?.total_appointments || 0),
    pendingAppointments: Number(appointmentsCounts?.pending_appointments || 0),
    totalInquiries: Number(inquiriesCounts?.total_inquiries || 0),
    unreadInquiries: Number(inquiriesCounts?.unread_inquiries || 0),
    recentActivity,
  };
}
