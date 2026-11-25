"use client";

import { useEffect, useState } from "react";
import { AdminTableSkeleton } from "@/components/skeletons";

type AppointmentStatus = "Requested" | "Confirmed" | "Dispatched" | "Completed" | "Cancelled";

type Appointment = {
  id: number;
  tracking_code: string;
  service_type: string;
  target: string;
  client_name: string;
  client_phone: string;
  client_email: string;
  preferred_date: string;
  preferred_time: string;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  estimated_kes: number | null;
  notes: string;
  status: AppointmentStatus;
  notification_status: string;
  notification_error: string | null;
  created_at: string;
};

const statuses: AppointmentStatus[] = ["Requested", "Confirmed", "Dispatched", "Completed", "Cancelled"];

function serviceName(service: string) {
  return {
    vehicle_inspection: "Vehicle inspection",
    property_viewing: "Property viewing",
    sanitation_service: "Sanitation dispatch",
  }[service] || service;
}

export default function AdminAppointments({ onChanged }: { onChanged?: () => void }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/appointments")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load appointments.");
        if (active) setAppointments(result.appointments);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load appointments.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function updateStatus(appointment: Appointment, status: AppointmentStatus) {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update appointment.");
      setAppointments((current) =>
        current.map((item) => (item.id === appointment.id ? { ...item, status: result.status } : item)),
      );
      setNotice(`Appointment ${appointment.tracking_code} updated to ${result.status}.`);
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update appointment.");
    }
  }

  return (
    <section className="admin-listings admin-appointments" id="appointments">
      <div className="admin-listings-head">
        <div><p>Schedule &amp; dispatch coordination</p><h2>Appointment &amp; sanitation requests</h2></div>
        <span className="admin-inquiry-count">{appointments.length} requests</span>
      </div>
      {error && <p className="journey-error application-error" role="alert">{error}</p>}
      {notice && <p className="admin-inquiry-notice" style={{ marginTop: 14 }} role="status">{notice}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Request</th><th>Client</th><th>Preferred slot</th><th>Location / Estimate</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td>
                  <strong>{appointment.target}</strong>
                  <span>{appointment.tracking_code} · {serviceName(appointment.service_type)}</span>
                  {appointment.notes && <span>{appointment.notes}</span>}
                </td>
                <td>
                  <strong>{appointment.client_name}</strong>
                  <span><a href={`tel:${appointment.client_phone}`}>{appointment.client_phone}</a></span>
                  {appointment.client_email && <span>{appointment.client_email}</span>}
                </td>
                <td>{appointment.preferred_date}<span>{appointment.preferred_time} EAT</span></td>
                <td>
                  <strong>{appointment.location || "—"}</strong>
                  {appointment.estimated_kes && (
                    <span>Est. KES {Number(appointment.estimated_kes).toLocaleString("en-KE")}</span>
                  )}
                  {appointment.location_latitude !== null && appointment.location_longitude !== null && (
                    <span>
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${appointment.location_latitude}&mlon=${appointment.location_longitude}#map=16/${appointment.location_latitude}/${appointment.location_longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View GPS pin →
                      </a>
                    </span>
                  )}
                </td>
                <td>
                  <select
                    className="admin-appointment-status"
                    aria-label={`Update appointment status for ${appointment.target}`}
                    value={appointment.status}
                    onChange={(event) => void updateStatus(appointment, event.target.value as AppointmentStatus)}
                  >
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <AdminTableSkeleton rows={4} cols={5} />}
        {!loading && appointments.length === 0 && !error && (
          <div className="admin-empty">New inspection, viewing and sanitation requests will appear here.</div>
        )}
      </div>
    </section>
  );
}
