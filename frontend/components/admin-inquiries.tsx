"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AdminTableSkeleton } from "@/components/skeletons";

type InquiryListing = {
  id: string;
  title: string;
  division: "Vehicles" | "Real Estate";
  detail: string;
};

type InquiryStatus = "unread" | "in_progress" | "resolved" | "archived";

type InquiryRecord = {
  id: number;
  tracking_code: string;
  source: string;
  listing_title: string;
  division: string;
  inquiry_type: string;
  full_name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: InquiryStatus;
  created_at: string;
};

const inquiryTypes = {
  Vehicles: ["Schedule Vehicle Inspection", "Vehicle Purchase Inquiry"],
  "Real Estate": ["Book Site Viewing", "Purchase / Payment Plan Inquiry", "Rental Terms Inquiry"],
} as const;

export default function AdminInquiries({ onChanged }: { onChanged?: () => void }) {
  const [listings, setListings] = useState<InquiryListing[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [selectedListing, setSelectedListing] = useState<InquiryListing | null>(null);
  const [inquiryType, setInquiryType] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [questions, setQuestions] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadInquiries() {
    const response = await fetch("/api/admin/inquiries");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load inquiry records.");
    setListings(result.listings);
    setInquiries(result.inquiries);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/inquiries")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load inquiry records.");
        if (active) {
          setListings(result.listings);
          setInquiries(result.inquiries);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load inquiry records.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  function openInquiry(listing: InquiryListing) {
    setSelectedListing(listing);
    setInquiryType(inquiryTypes[listing.division]?.[0] || "General Inquiry");
    setClientName("");
    setClientPhone("");
    setQuestions("");
    setError("");
    setNotice("");
  }

  async function submitInquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedListing) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selectedListing.id,
          inquiryType,
          clientName,
          clientPhone,
          questions,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save this inquiry.");
      setSelectedListing(null);
      setNotice(result.notice);
      await loadInquiries();
      onChanged?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this inquiry.");
    } finally {
      setBusy(false);
    }
  }

  async function updateInquiryStatus(id: number, status: InquiryStatus) {
    setError("");
    const response = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!response.ok) {
      const res = await response.json();
      setError(res.error || "Could not update inquiry.");
      return;
    }
    setInquiries((cur) => cur.map((item) => (item.id === id ? { ...item, status } : item)));
    onChanged?.();
  }

  return (
    <>
      <section className="admin-listings admin-inquiries" id="enquiries">
        <div className="admin-listings-head">
          <div><p>Customer follow-up</p><h2>Enquiries &amp; website messages</h2></div>
          <span className="admin-inquiry-count">{inquiries.length} records</span>
        </div>
        {notice && <p className="admin-inquiry-notice" style={{ marginTop: 14 }} role="status">{notice}</p>}
        {error && <p className="journey-error application-error" role="alert">{error}</p>}

        <div className="admin-inquiry-listings">
          {listings.map((listing) => (
            <article key={listing.id}>
              <div>
                <span className="admin-division">{listing.division}</span>
                <h3>{listing.title}</h3>
                <p>{listing.detail}</p>
              </div>
              <button type="button" className="admin-inquiry-open" onClick={() => openInquiry(listing)}>
                Log inquiry
              </button>
            </article>
          ))}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-inquiry-table">
            <thead>
              <tr><th>Subject / Listing</th><th>Client</th><th>Contact</th><th>Message</th><th>Status</th></tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td>
                    <strong>{inquiry.listing_title || inquiry.subject || inquiry.division}</strong>
                    <span>{inquiry.tracking_code} · {inquiry.inquiry_type}</span>
                  </td>
                  <td>
                    <strong>{inquiry.full_name || "Not provided"}</strong>
                    <span>{inquiry.source === "website_contact" ? "Website form" : "Staff logged"}</span>
                  </td>
                  <td>
                    <a href={`tel:${inquiry.phone}`}>{inquiry.phone}</a>
                    {inquiry.email && <span>{inquiry.email}</span>}
                  </td>
                  <td style={{ maxWidth: 260, whiteSpace: "normal", lineHeight: 1.4 }}>{inquiry.message}</td>
                  <td>
                    <select
                      className="admin-appointment-status"
                      aria-label={`Update status for ${inquiry.tracking_code}`}
                      value={inquiry.status}
                      onChange={(e) => void updateInquiryStatus(inquiry.id, e.target.value as InquiryStatus)}
                    >
                      <option value="unread">Unread</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <AdminTableSkeleton rows={4} cols={5} />}
          {!loading && inquiries.length === 0 && (
            <div className="admin-empty">No enquiries have been recorded yet.</div>
          )}
        </div>
      </section>

      {selectedListing && (
        <div
          className="admin-modal-backdrop admin-inquiry-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setSelectedListing(null);
          }}
        >
          <section
            className="admin-modal admin-inquiry-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-inquiry-title"
          >
            <div className="admin-modal-head admin-inquiry-head">
              <div>
                <p>{selectedListing.division}</p>
                <h2 id="admin-inquiry-title">Log Inquiry: {selectedListing.title}</h2>
                <span>{selectedListing.detail}</span>
              </div>
              <button type="button" disabled={busy} onClick={() => setSelectedListing(null)} aria-label="Close inquiry">×</button>
            </div>

            <form className="admin-inquiry-form" onSubmit={submitInquiry}>
              <label>
                Inquiry Type
                <select value={inquiryType} onChange={(event) => setInquiryType(event.target.value)} required>
                  {(inquiryTypes[selectedListing.division] || ["General Inquiry"]).map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                Client Name
                <input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={120} required />
              </label>
              <label>
                Phone / WhatsApp Number
                <input
                  type="tel"
                  autoComplete="tel"
                  placeholder="+254 7xx xxx xxx"
                  value={clientPhone}
                  onChange={(event) => setClientPhone(event.target.value)}
                  required
                />
              </label>
              <label>
                Preferred Date or Questions
                <textarea rows={4} maxLength={2000} value={questions} onChange={(event) => setQuestions(event.target.value)} />
              </label>
              {error && <p className="journey-error" role="alert">{error}</p>}
              <div className="admin-inquiry-actions">
                <button type="button" onClick={() => setSelectedListing(null)} disabled={busy}>Cancel</button>
                <button type="submit" disabled={busy}>{busy ? "Saving inquiry…" : "Submit Inquiry"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
