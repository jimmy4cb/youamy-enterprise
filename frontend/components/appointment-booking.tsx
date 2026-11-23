"use client";

import { useEffect, useState, type FormEvent } from "react";
import LocationPicker, { type MapPin } from "@/components/location-picker";

export type AppointmentType =
  | "vehicle_inspection"
  | "property_viewing"
  | "sanitation_service";

type Props = {
  serviceType: AppointmentType;
  initialTarget?: string;
  variant?: "inline" | "dialog";
  onClose?: () => void;
};

const timeSlots = [
  ["09:00", "9:00 am"],
  ["10:30", "10:30 am"],
  ["12:00", "12:00 pm"],
  ["14:00", "2:00 pm"],
  ["15:30", "3:30 pm"],
];

const sanitationServices = [
  "Septic Tank Cleaning (Exhauster)",
  "Garbage Collection",
  "Waste Management Solutions",
  "Commercial & Residential Cleaning",
];

function nairobiToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function nairobiTime() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("hour")}:${value("minute")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function AppointmentCalendar({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const todayKey = nairobiToday();
  const today = dateFromKey(todayKey);
  const [month, setMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonth = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const startingOffset = (firstDay.getDay() + 6) % 7;
  const monthLabel = month.toLocaleDateString("en", { month: "long", year: "numeric" });

  function changeMonth(offset: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <div className="appointment-calendar">
      <div className="appointment-calendar-head">
        <div>
          <strong>Choose a date</strong>
          <span>Times are requests until our team confirms.</span>
        </div>
        <div className="appointment-month-controls">
          <button
            type="button"
            aria-label="Previous month"
            disabled={month <= currentMonth}
            onClick={() => changeMonth(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={month >= lastMonth}
            onClick={() => changeMonth(1)}
          >
            ›
          </button>
        </div>
      </div>
      <p className="appointment-month-label" aria-live="polite">{monthLabel}</p>
      <div className="appointment-calendar-grid" role="grid" aria-label={monthLabel}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <span className="appointment-weekday" role="columnheader" key={day}>{day}</span>
        ))}
        {Array.from({ length: startingOffset }, (_, index) => (
          <span className="appointment-calendar-empty" aria-hidden="true" key={`empty-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
          const disabled = key < todayKey;
          return (
            <button
              type="button"
              role="gridcell"
              className="appointment-day"
              key={key}
              disabled={disabled}
              aria-label={dateFromKey(key).toLocaleDateString("en", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              aria-pressed={value === key}
              onClick={() => onChange(key)}
            >
              {day}
            </button>
          );
        })}
      </div>
      {value && (
        <p className="appointment-selected-date">
          Selected: {dateFromKey(value).toLocaleDateString("en-KE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

function AppointmentForm({
  serviceType,
  initialTarget,
  onClose,
  variant = "inline",
}: Pick<Props, "serviceType" | "initialTarget" | "onClose" | "variant">) {
  const [target, setTarget] = useState(
    initialTarget || (serviceType === "sanitation_service" ? sanitationServices[0] : ""),
  );
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [location, setLocation] = useState("");
  const [locationPin, setLocationPin] = useState<MapPin | null>(null);
  const [notes, setNotes] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [schedulerOpen, setSchedulerOpen] = useState(variant === "dialog");

  const title = serviceType === "vehicle_inspection"
    ? "Schedule vehicle inspection"
    : serviceType === "property_viewing"
      ? "Schedule a property viewing"
      : "Schedule sanitation service";

  async function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (serviceType === "sanitation_service" && !locationPin) {
      setError("Pin the service location on the map.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const submissionId = requestId || crypto.randomUUID();
    setRequestId(submissionId);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: submissionId,
          serviceType,
          target,
          clientName,
          clientPhone,
          preferredDate,
          preferredTime,
          location,
          locationLatitude: locationPin?.latitude ?? null,
          locationLongitude: locationPin?.longitude ?? null,
          notes,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your appointment request.");
      setNotice(result.notice);
      setRequestId(crypto.randomUUID());
      setPreferredDate("");
      setPreferredTime("");
    } catch (reason) {
      setError(reason instanceof Error
        ? reason.message
        : "Could not save your appointment request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="appointment-form" onSubmit={submitAppointment}>
      <div className="appointment-form-heading">
        <h3>{title}</h3>
        <p>Pick a preferred date and time. Our team will contact you to confirm.</p>
      </div>
      {serviceType === "sanitation_service" ? (
        <label className="appointment-field appointment-field-wide">
          Select service
          <select value={target} onChange={(event) => setTarget(event.target.value)} required>
            {sanitationServices.map((service) => <option key={service}>{service}</option>)}
          </select>
        </label>
      ) : (
        <p className="appointment-target">{target}</p>
      )}

      <div className="appointment-fields">
        <label className="appointment-field appointment-field-wide">
          Full name / company name
          <input
            autoComplete="name"
            maxLength={120}
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            required
          />
        </label>
        <label className="appointment-field">
          Phone number
          <input
            type="tel"
            autoComplete="tel"
            placeholder="+254 7xx xxx xxx"
            maxLength={32}
            value={clientPhone}
            onChange={(event) => setClientPhone(event.target.value)}
            required
          />
        </label>
        <label className="appointment-field">
          {serviceType === "sanitation_service" ? "Estate, street or landmark" : "Location"}
          <input
            autoComplete="street-address"
            maxLength={180}
            placeholder={serviceType === "sanitation_service" ? "e.g. Nyali, near City Mall" : "Area or meeting point"}
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            required={serviceType === "sanitation_service"}
          />
        </label>
      </div>
      {serviceType === "sanitation_service" && (
        <LocationPicker onChange={setLocationPin} />
      )}

      {!schedulerOpen ? (
        <button
          type="button"
          className="appointment-open-scheduler"
          onClick={() => setSchedulerOpen(true)}
        >
          Choose date and time
        </button>
      ) : (
        <>
          <AppointmentCalendar value={preferredDate} onChange={setPreferredDate} />

          <fieldset className="appointment-time-picker">
            <legend>Preferred time</legend>
            <div>
              {timeSlots.map(([time, label]) => {
                const unavailable = preferredDate === nairobiToday() && time <= nairobiTime();
                return (
                  <button
                    type="button"
                    className={`${preferredTime === time ? "selected" : ""}${unavailable ? " unavailable" : ""}`}
                    aria-pressed={preferredTime === time}
                    disabled={unavailable}
                    key={time}
                    onClick={() => setPreferredTime(time)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </>
      )}

      <label className="appointment-field appointment-field-wide">
        Additional notes
        <textarea
          rows={3}
          maxLength={2000}
          placeholder={serviceType === "sanitation_service"
            ? "Tank size, gate access or service details"
            : "Anything the team should know before your appointment"}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>

      {error && <p className="appointment-error" role="alert">{error}</p>}
      {notice && <p className="appointment-success" role="status">{notice}</p>}
      <div className="appointment-submit-row">
        <button
          type="submit"
          className="appointment-submit"
          disabled={busy || !preferredDate || !preferredTime}
        >
          {busy ? "Sending request…" : "Request appointment"}
        </button>
        {onClose && (
          <button type="button" className="appointment-cancel" disabled={busy} onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </form>
  );
}

export default function AppointmentBooking(props: Props) {
  const { variant = "inline", onClose } = props;

  useEffect(() => {
    if (variant !== "dialog" || !onClose) return;
    const close = onClose;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [variant, onClose]);

  if (variant === "dialog") {
    return (
      <div
        className="appointment-dialog-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <section
          className="appointment-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Request an appointment"
        >
          <button type="button" className="appointment-dialog-close" onClick={onClose} aria-label="Close appointment form">
            ×
          </button>
          <AppointmentForm {...props} />
        </section>
      </div>
    );
  }

  return (
    <section className="sanitation-booking-panel" aria-label="Schedule a sanitation service">
      <AppointmentForm {...props} />
    </section>
  );
}
