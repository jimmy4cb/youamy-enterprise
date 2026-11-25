-- Youamy Enterprises Limited - MySQL / MariaDB Schema
-- Charset: utf8mb4 / InnoDB

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin', 'listings_admin', 'orders_admin', 'support_agent', 'content_editor') NOT NULL DEFAULT 'support_agent',
  totp_secret VARCHAR(64) NULL,
  totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX admin_sessions_user_idx (user_id),
  INDEX admin_sessions_expires_idx (expires_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_pending_logins (
  token VARCHAR(128) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  setup_secret VARCHAR(64) NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX admin_pending_expires_idx (expires_at),
  CONSTRAINT fk_admin_pending_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  actor_name VARCHAR(120) NOT NULL DEFAULT 'System',
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL DEFAULT 'system',
  entity_id VARCHAR(64) NULL,
  details VARCHAR(500) NOT NULL DEFAULT '',
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX activity_log_created_idx (created_at),
  INDEX activity_log_action_idx (action),
  CONSTRAINT fk_activity_log_user FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(180) NULL UNIQUE,
  phone VARCHAR(32) NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  loyalty_tier ENUM('standard', 'corporate', 'vip') NOT NULL DEFAULT 'standard',
  city VARCHAR(100) NOT NULL DEFAULT '',
  notes TEXT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customer_sessions (
  id VARCHAR(128) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX customer_sessions_customer_idx (customer_id),
  INDEX customer_sessions_expires_idx (expires_at),
  CONSTRAINT fk_customer_sessions_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  destination_country VARCHAR(80) NOT NULL,
  destination_city VARCHAR(80) NOT NULL,
  role_category VARCHAR(80) NOT NULL,
  employer_name VARCHAR(160) NOT NULL DEFAULT 'Verified GCC Partner',
  openings_total INT UNSIGNED NOT NULL DEFAULT 1,
  openings_filled INT UNSIGNED NOT NULL DEFAULT 0,
  salary_amount DECIMAL(12,2) NULL,
  salary_currency VARCHAR(12) NOT NULL DEFAULT 'SAR',
  compensation_display VARCHAR(160) NOT NULL,
  contract_months INT UNSIGNED NOT NULL DEFAULT 24,
  requirements TEXT NOT NULL,
  benefits TEXT NOT NULL,
  deadline DATE NOT NULL,
  status ENUM('Published', 'Draft', 'Closed', 'Archived') NOT NULL DEFAULT 'Published',
  featured TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX jobs_status_deadline_idx (status, deadline),
  CONSTRAINT fk_jobs_created_by FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id CHAR(36) NOT NULL UNIQUE,
  tracking_code VARCHAR(32) NOT NULL UNIQUE,
  job_id BIGINT UNSIGNED NULL,
  job_title VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(180) NOT NULL DEFAULT '',
  experience TEXT NULL,
  notes TEXT NULL,
  cv_name VARCHAR(255) NOT NULL,
  cv_type VARCHAR(140) NOT NULL,
  cv_size INT UNSIGNED NOT NULL,
  cv_data LONGTEXT NOT NULL,
  status ENUM('New', 'Reviewed', 'Shortlisted', 'Visa Processing', 'Placed', 'Rejected') NOT NULL DEFAULT 'New',
  staff_notes TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX job_apps_status_created_idx (status, created_at),
  INDEX job_apps_job_idx (job_id),
  INDEX job_apps_phone_idx (phone),
  CONSTRAINT fk_job_apps_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
  CONSTRAINT fk_job_apps_reviewer FOREIGN KEY (reviewed_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_application_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  job_application_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(40) NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  updated_by_name VARCHAR(120) NOT NULL DEFAULT 'Recruitment Team',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX job_app_events_app_idx (job_application_id, created_at),
  CONSTRAINT fk_job_app_events_app FOREIGN KEY (job_application_id) REFERENCES job_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id CHAR(36) PRIMARY KEY,
  slug VARCHAR(180) NOT NULL UNIQUE,
  title VARCHAR(180) NOT NULL,
  division ENUM('Vehicles', 'Real Estate', 'Sanitation', 'Other') NOT NULL,
  listing_kind ENUM('vehicle_sale', 'vehicle_hire', 'property_sale', 'property_rent', 'short_stay', 'sanitation_package', 'general') NOT NULL DEFAULT 'general',
  description TEXT NOT NULL,
  location VARCHAR(160) NOT NULL DEFAULT 'Kenya',
  specs JSON NULL,
  image_urls JSON NOT NULL,
  amount_kes BIGINT UNSIGNED NOT NULL,
  price_unit ENUM('total', 'per_day', 'per_night', 'per_month', 'per_trip') NOT NULL DEFAULT 'total',
  deposit_percent TINYINT UNSIGNED NOT NULL DEFAULT 100,
  stock_quantity INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('available', 'reserved', 'booked', 'sold', 'unavailable', 'draft', 'archived') NOT NULL DEFAULT 'available',
  purchasable TINYINT(1) NOT NULL DEFAULT 1,
  featured TINYINT(1) NOT NULL DEFAULT 1,
  booking_kind ENUM('none', 'car', 'short_stay', 'sanitation') NOT NULL DEFAULT 'none',
  created_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX products_division_status_idx (division, status, purchasable),
  CONSTRAINT fk_products_created_by FOREIGN KEY (created_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carts (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL UNIQUE,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_carts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cart_items (
  id CHAR(36) PRIMARY KEY,
  cart_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  booking_details JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY cart_items_unique (cart_id, product_id),
  CONSTRAINT fk_cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_items (
  customer_id CHAR(36) NOT NULL,
  product_id CHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (customer_id, product_id),
  CONSTRAINT fk_saved_items_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  order_number VARCHAR(32) NOT NULL UNIQUE,
  customer_id CHAR(36) NOT NULL,
  checkout_key CHAR(36) NOT NULL,
  status ENUM('Pending payment', 'Placed', 'Confirmed', 'In progress', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending payment',
  payment_status ENUM('pending', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  currency VARCHAR(8) NOT NULL DEFAULT 'KES',
  total_amount BIGINT UNSIGNED NOT NULL,
  cancel_requested_at DATETIME(3) NULL,
  cancel_reason VARCHAR(500) NULL,
  notes TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY orders_customer_checkout_unique (customer_id, checkout_key),
  INDEX orders_customer_created_idx (customer_id, created_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  product_id CHAR(36) NULL,
  title VARCHAR(180) NOT NULL,
  division VARCHAR(60) NOT NULL DEFAULT '',
  quantity INT UNSIGNED NOT NULL,
  unit_amount BIGINT UNSIGNED NOT NULL,
  line_total BIGINT UNSIGNED NOT NULL,
  booking_details JSON NOT NULL,
  INDEX order_items_order_idx (order_id),
  INDEX order_items_product_idx (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  provider ENUM('mpesa', 'flutterwave', 'manual') NOT NULL,
  reference VARCHAR(80) NOT NULL UNIQUE,
  provider_transaction_id VARCHAR(120) NULL UNIQUE,
  amount BIGINT UNSIGNED NOT NULL,
  status ENUM('pending', 'successful', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  metadata JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX payments_order_status_idx (order_id, status),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_events (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  customer_id CHAR(36) NOT NULL,
  status VARCHAR(40) NOT NULL,
  note VARCHAR(500) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX order_events_order_idx (order_id, created_at),
  CONSTRAINT fk_order_events_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_alerts (
  id CHAR(36) PRIMARY KEY,
  customer_id CHAR(36) NOT NULL,
  order_id CHAR(36) NULL,
  message VARCHAR(500) NOT NULL,
  read_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX client_alerts_customer_idx (customer_id, created_at),
  CONSTRAINT fk_client_alerts_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_alerts_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_id CHAR(36) NOT NULL UNIQUE,
  tracking_code VARCHAR(32) NOT NULL UNIQUE,
  service_type ENUM('vehicle_inspection', 'property_viewing', 'sanitation_service') NOT NULL,
  product_id CHAR(36) NULL,
  target VARCHAR(180) NOT NULL,
  client_name VARCHAR(120) NOT NULL,
  client_phone VARCHAR(32) NOT NULL,
  client_email VARCHAR(180) NOT NULL DEFAULT '',
  preferred_date DATE NOT NULL,
  preferred_time VARCHAR(16) NOT NULL,
  location VARCHAR(180) NOT NULL DEFAULT '',
  location_latitude DOUBLE NULL,
  location_longitude DOUBLE NULL,
  estimated_kes BIGINT UNSIGNED NULL,
  service_options JSON NULL,
  notes TEXT NULL,
  staff_notes TEXT NULL,
  status ENUM('Requested', 'Confirmed', 'Dispatched', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Requested',
  notification_status ENUM('pending', 'sent', 'failed', 'not_configured') NOT NULL DEFAULT 'pending',
  notification_error VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX appointments_schedule_idx (preferred_date, preferred_time, created_at),
  INDEX appointments_service_status_idx (service_type, status),
  CONSTRAINT fk_appointments_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS inquiries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  inquiry_id CHAR(36) NOT NULL UNIQUE,
  tracking_code VARCHAR(32) NOT NULL UNIQUE,
  source ENUM('public_form', 'listing_inquiry', 'admin_manual') NOT NULL DEFAULT 'public_form',
  listing_id CHAR(36) NULL,
  listing_title VARCHAR(180) NOT NULL DEFAULT '',
  division VARCHAR(60) NOT NULL DEFAULT 'General',
  inquiry_type VARCHAR(100) NOT NULL DEFAULT 'General Inquiry',
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(180) NOT NULL DEFAULT '',
  phone VARCHAR(32) NOT NULL DEFAULT '',
  subject VARCHAR(180) NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status ENUM('unread', 'in_progress', 'resolved', 'archived') NOT NULL DEFAULT 'unread',
  staff_notes TEXT NULL,
  assigned_to BIGINT UNSIGNED NULL,
  notification_status ENUM('pending', 'sent', 'failed', 'not_configured') NOT NULL DEFAULT 'pending',
  notification_error VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  INDEX inquiries_status_created_idx (status, created_at),
  CONSTRAINT fk_inquiries_assigned FOREIGN KEY (assigned_to) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
  setting_key VARCHAR(80) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_site_settings_user FOREIGN KEY (updated_by) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
