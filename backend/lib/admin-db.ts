import bcrypt from "bcryptjs";
import { open, type Database } from "sqlite";
import sqlite3 from "sqlite3";
import path from "node:path";
import fs from "node:fs";

export type AdminRole =
  | "super_admin"
  | "listings_admin"
  | "orders_admin"
  | "support_agent"
  | "content_editor";

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  totp_secret: string | null;
  active: number;
};

let databasePromise: Promise<Database> | null = null;

export function getAdminDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const dataDirectory = path.join(process.cwd(), "data");
      await fs.promises.mkdir(dataDirectory, { recursive: true });
      const db = await open({
        filename: path.join(dataDirectory, "youamy-admin.sqlite"),
        driver: sqlite3.Database,
      }) as Database;
      await db.exec(`
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS admin_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL,
          totp_secret TEXT,
          active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS admin_sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS admin_listings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          division TEXT NOT NULL,
          detail TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'Draft',
          archived INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (created_by) REFERENCES admin_users(id)
        );
        CREATE TABLE IF NOT EXISTS activity_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          action TEXT NOT NULL,
          details TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES admin_users(id)
        );
        CREATE TABLE IF NOT EXISTS listing_inquiries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          submission_id TEXT NOT NULL UNIQUE,
          listing_id INTEGER,
          listing_title TEXT NOT NULL,
          division TEXT NOT NULL CHECK (division IN ('Vehicles', 'Real Estate')),
          inquiry_type TEXT NOT NULL,
          client_name TEXT NOT NULL DEFAULT '',
          client_phone TEXT NOT NULL,
          questions TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Closed')),
          notification_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_configured')),
          notification_error TEXT,
          created_by INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (listing_id) REFERENCES admin_listings(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES admin_users(id)
        );
        CREATE TABLE IF NOT EXISTS appointment_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id TEXT NOT NULL UNIQUE,
          service_type TEXT NOT NULL CHECK (
            service_type IN ('vehicle_inspection', 'property_viewing', 'sanitation_service')
          ),
          target TEXT NOT NULL,
          client_name TEXT NOT NULL,
          client_phone TEXT NOT NULL,
          preferred_date TEXT NOT NULL,
          preferred_time TEXT NOT NULL,
          location TEXT NOT NULL DEFAULT '',
          location_latitude REAL,
          location_longitude REAL,
          notes TEXT NOT NULL DEFAULT '',
          status TEXT NOT NULL DEFAULT 'Requested'
            CHECK (status IN ('Requested', 'Confirmed', 'Completed', 'Cancelled')),
          notification_status TEXT NOT NULL DEFAULT 'pending'
            CHECK (notification_status IN ('pending', 'sent', 'failed', 'not_configured')),
          notification_error TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS job_applications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          application_id TEXT NOT NULL UNIQUE,
          job_title TEXT NOT NULL,
          destination TEXT NOT NULL,
          full_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          email TEXT NOT NULL DEFAULT '',
          experience TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          cv_name TEXT NOT NULL,
          cv_type TEXT NOT NULL,
          cv_size INTEGER NOT NULL,
          cv_data BLOB NOT NULL,
          status TEXT NOT NULL DEFAULT 'New'
            CHECK (status IN ('New', 'Reviewed', 'Shortlisted', 'Rejected')),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS job_applications_created_at_idx
          ON job_applications(created_at DESC);
        CREATE INDEX IF NOT EXISTS appointment_requests_created_at_idx
          ON appointment_requests(created_at DESC);
        CREATE TRIGGER IF NOT EXISTS log_appointment_request_created
        AFTER INSERT ON appointment_requests
        BEGIN
          INSERT INTO activity_log (user_id, action, details)
          VALUES (
            NULL,
            'appointment.requested',
            COALESCE(NEW.client_name, 'Customer') || ' · ' || NEW.target || ' · ' ||
              NEW.preferred_date || ' ' || NEW.preferred_time
          );
        END;
        CREATE INDEX IF NOT EXISTS listing_inquiries_created_at_idx
          ON listing_inquiries(created_at DESC);
        CREATE TRIGGER IF NOT EXISTS log_listing_inquiry_created
        AFTER INSERT ON listing_inquiries
        BEGIN
          INSERT INTO activity_log (user_id, action, details)
          VALUES (
            NEW.created_by,
            'inquiry.created',
            NEW.listing_title || ' · ' || NEW.inquiry_type
          );
        END;
      `);

      const appointmentColumns = await db.all(
        "PRAGMA table_info(appointment_requests)",
      ) as Array<{ name: string }>;
      if (!appointmentColumns.some((column) => column.name === "location_latitude")) {
        await db.exec("ALTER TABLE appointment_requests ADD COLUMN location_latitude REAL");
      }
      if (!appointmentColumns.some((column) => column.name === "location_longitude")) {
        await db.exec("ALTER TABLE appointment_requests ADD COLUMN location_longitude REAL");
      }

      const superAdmin = await db.get("SELECT id FROM admin_users WHERE email = ?", [
        "superadmin@youamy.co.ke",
      ]);
      if (!superAdmin) {
        const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
        await db.run(
          "INSERT INTO admin_users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
          ["YEL Super Admin", "superadmin@youamy.co.ke", passwordHash, "super_admin"],
        );
      }
      const listingCount = await db.get("SELECT COUNT(*) AS count FROM admin_listings");
      if (listingCount?.count === 0) {
        await db.run(
          `INSERT INTO admin_listings (title, division, detail, status, created_by)
           SELECT title, division, detail, status, (SELECT id FROM admin_users WHERE role = 'super_admin' LIMIT 1)
           FROM (SELECT 'Heavy Duty Trailer Drivers (GCC License)' title, 'Jobs' division, 'Saudi Arabia · Riyadh · 25 slots' detail, 'Published' status
                 UNION ALL SELECT '2019 Toyota Land Cruiser Prado TX-L', 'Vehicles', 'Available · Ksh 6,850,000', 'Published'
                 UNION ALL SELECT 'Modern 4-Bedroom Villa with DSQ', 'Real Estate', 'Nyali, Mombasa · Ksh 32,000,000', 'Published'
                 UNION ALL SELECT 'Exhauster septic cleaning', 'Sanitation', 'Mombasa / Nairobi Corridor', 'Published')`,
        );
      }
      return db;
    }) as unknown as Promise<Database>;
  }
  return databasePromise;
}
