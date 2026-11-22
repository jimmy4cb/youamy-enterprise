"use client";

import { useEffect, useState, type FormEvent } from "react";

type InquiryListing = {
  id: number;
  title: string;
  division: "Vehicles" | "Real Estate";
  detail: string;
};

type InquiryRecord = {
  id: number;
  listing_title: string;
  division: string;
  inquiry_type: string;
  client_name: string;
  client_phone: string;
  questions: string;
  status: string;
  notification_status: "pending" | "sent" | "failed" | "not_configured";
  notification_error: string | null;
  created_at: string;
};

const inquiryTypes = {
  Vehicles: ["Schedule Vehicle Inspection", "Vehicle Purchase Inquiry"],
  "Real Estate": ["Book Site Viewing", "Purchase / Payment Plan Inquiry", "Rental Terms Inquiry"],
} as const;

export default function AdminInquiries() {
  const [listings, setListings] = useState<InquiryListing[]>([]);
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [selectedListing, setSelectedListing] = useState<InquiryListing | null>(null);
  const [requestId, setRequestId] = useState("");
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

  useEffect(() => {
    if (!selectedListing) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) setSelectedListing(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedListing, busy]);

  function openInquiry(listing: InquiryListing) {
    setSelectedListing(listing);
    setRequestId(crypto.randomUUID());
    setInquiryType(inquiryTypes[listing.division][0]);
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
          requestId,
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
      try {
        await loadInquiries();
      } catch {
        setError("Inquiry was saved, but the inquiry list could not be refreshed.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save this inquiry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="admin-listings admin-inquiries" id="enquiries">
        <div className="admin-listings-head">
          <div><p>Customer follow-up</p><h2>Enquiries</h2></div>
          <span className="admin-inquiry-count">{inquiries.length} recent</span>
        </div>
        {notice && <p className="admin-inquiry-notice" role="status">{notice}</p>}
        {error && <p className="journey-error" role="alert">{error}</p>}

        <div className="admin-inquiry-listings">
          {listings.map((listing) => (
            <article key={listing.id}>
              <div>
                <span className="admin-division">{listing.division}</span>
                <h3>{listing.title}</h3>
                <p>{listing.detail}</p>
              </div>
              <button type="button" className="admin-inquiry-open" onClick={() => openInquiry(listing)}>
                Create inquiry
              </button>
            </article>
          ))}
          {!loading && listings.length === 0 && (
            <div className="admin-empty">Publish a vehicle or property listing to record a customer inquiry.</div>
          )}
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table admin-inquiry-table">
            <thead>
              <tr><th>Listing</th><th>Client</th><th>Phone</th><th>Inquiry</th><th>Email</th><th>Received</th></tr>
            </thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id}>
                  <td><strong>{inquiry.listing_title}</strong><span>{inquiry.division}</span></td>
                  <td>{inquiry.client_name || "Not provided"}</td>
                  <td><a href={`tel:${inquiry.client_phone}`}>{inquiry.client_phone}</a></td>
                  <td>{inquiry.inquiry_type}</td>
                  <td title={inquiry.notification_error || undefined}>
                    {inquiry.notification_status === "sent" ? "Sent" : "Not sent"}
                  </td>
                  <td>{new Date(`${inquiry.created_at.replace(" ", "T")}Z`).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
                <h2 id="admin-inquiry-title">
                  {selectedListing.division === "Vehicles" ? "Inquire / Book Inspection" : "Property Inquiry"}: {selectedListing.title}
                </h2>
                <span>{selectedListing.detail}</span>
              </div>
              <button type="button" disabled={busy} onClick={() => setSelectedListing(null)} aria-label="Close inquiry">×</button>
            </div>

            <form className="admin-inquiry-form" onSubmit={submitInquiry}>
              <label>
                Inquiry Type
                <select value={inquiryType} onChange={(event) => setInquiryType(event.target.value)} required>
                  {inquiryTypes[selectedListing.division].map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              {selectedListing.division === "Vehicles" && (
                <label>
                  Your Name
                  <input autoFocus value={clientName} onChange={(event) => setClientName(event.target.value)} maxLength={120} required />
                </label>
              )}
              <label>
                Phone / WhatsApp Number
                <input
                  autoFocus={selectedListing.division === "Real Estate"}
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
