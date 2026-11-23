"use client";

import { useEffect, useState } from "react";

type Appointment = {
  id: number;
  service_type: string;
  target: string;
  client_name: string;
  client_phone: string;
  preferred_date: string;
  preferred_time: string;
  location: string;
  location_latitude: number | null;
  location_longitude: number | null;
  notes: string;
  status: "Requested" | "Confirmed" | "Completed" | "Cancelled";
  notification_status: "pending" | "sent" | "failed" | "not_configured";
  notification_error: string | null;
  created_at: string;
};

const statuses: Appointment["status"][] = ["Requested", "Confirmed", "Completed", "Cancelled"];

function serviceName(service: string) {
  return {
    vehicle_inspection: "Vehicle inspection",
    property_viewing: "Property viewing",
    sanitation_service: "Sanitation service",
  }[service] || service;
}

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  async function updateStatus(appointment: Appointment, status: Appointment["status"]) {
    setError("");
    try {
      const response = await fetch("/api/admin/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update appointment.");
      setAppointments((current) => current.map((item) =>
        item.id === appointment.id ? { ...item, status: result.status } : item,
      ));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update appointment.");
    }
  }

  return (
    <section className="admin-listings admin-appointments" id="appointments">
      <div className="admin-listings-head">
        <div><p>Schedule coordination</p><h2>Appointment requests</h2></div>
        <span className="admin-inquiry-count">{appointments.length} requests</span>
      </div>
      {error && <p className="journey-error" role="alert">{error}</p>}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Request</th><th>Client</th><th>Preferred time</th><th>Location</th><th>Email</th><th>Status</th></tr>
          </thead>
          <tbody>
            {appointments.map((appointment) => (
              <tr key={appointment.id}>
                <td>
                  <strong>{appointment.target}</strong>
                  <span>{serviceName(appointment.service_type)}</span>
                  {appointment.notes && <span>{appointment.notes}</span>}
                </td>
                <td>
                  <strong>{appointment.client_name}</strong>
                  <span><a href={`tel:${appointment.client_phone}`}>{appointment.client_phone}</a></span>
                </td>
                <td>{appointment.preferred_date}<span>{appointment.preferred_time}</span></td>
                <td>
                  {appointment.location || "—"}
                  {appointment.location_latitude !== null && appointment.location_longitude !== null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${appointment.location_latitude}&mlon=${appointment.location_longitude}#map=16/${appointment.location_latitude}/${appointment.location_longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View pinned location
                    </a>
                  )}
                </td>
                <td title={appointment.notification_error || undefined}>
                  {appointment.notification_status === "sent" ? "Sent" : "Not sent"}
                </td>
                <td>
                  <select
                    className="admin-appointment-status"
                    aria-label={`Update appointment status for ${appointment.target}`}
                    value={appointment.status}
                    onChange={(event) => updateStatus(appointment, event.target.value as Appointment["status"])}
                  >
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="admin-empty">Loading appointment requests…</div>}
        {!loading && appointments.length === 0 && !error && (
          <div className="admin-empty">New inspection, viewing and service requests will appear here.</div>
        )}
      </div>
    </section>
  );
}
