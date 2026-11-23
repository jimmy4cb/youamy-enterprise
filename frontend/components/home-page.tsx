"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import ProductBrowser from "@/components/product-browser";
import AppointmentBooking, { type AppointmentType } from "@/components/appointment-booking";
import {
  company,
  divisions,
  emailLink,
  jobListings,
  officeCoordinates,
  propertyListings,
  vehicleListings,
  whatsappLink,
} from "@/components/site-data";

type DivisionId = "jobs" | "vehicles" | "real-estate" | "sanitation";
type DialogType = "cart" | "signin" | "tracking" | null;

const navigation = [
  ["Gulf Recruitment", "#jobs"],
  ["Auto Marketplace", "#vehicles"],
  ["Real Estate", "#real-estate"],
  ["Sanitation", "#sanitation"],
  ["About", "#about"],
  ["Contact", "#contact"],
];

function PhotoSlider({
  imageUrls,
  alt,
  status,
  className,
}: {
  imageUrls: string[];
  alt: string;
  status: string;
  className: string;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const previousPhoto = () => {
    setPhotoIndex((current) => (current - 1 + imageUrls.length) % imageUrls.length);
  };
  const nextPhoto = () => {
    setPhotoIndex((current) => (current + 1) % imageUrls.length);
  };

  return (
    <div className={className}>
      <Image
        src={imageUrls[photoIndex]}
        alt={`${alt} photo ${photoIndex + 1}`}
        fill
        unoptimized
        sizes="(max-width: 700px) 100vw, 33vw"
      />
      {imageUrls.length > 1 && (
        <>
          <button type="button" className="photo-slider-button previous" onClick={previousPhoto} aria-label={`Previous photo of ${alt}`}>
            ‹
          </button>
          <button type="button" className="photo-slider-button next" onClick={nextPhoto} aria-label={`Next photo of ${alt}`}>
            ›
          </button>
          <span className="photo-count" aria-label={`Photo ${photoIndex + 1} of ${imageUrls.length}`}>
            {photoIndex + 1} / {imageUrls.length}
          </span>
        </>
      )}
      <span className="listing-status">{status}</span>
    </div>
  );
}

function DivisionGlyph({ id }: { id: DivisionId }) {
  const paths: Record<DivisionId, string> = {
    jobs: "M9 6V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V6m-12 4h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm5 4v2h4v-2",
    vehicles: "M3 13.5 5.2 7h12.6l3.2 6.5V19h-2.2a2.3 2.3 0 0 1-4.6 0H9.8a2.3 2.3 0 0 1-4.6 0H3v-5.5Zm2.2-1h13.9M5.2 16.7h.1m13.7 0h.1",
    "real-estate": "M4 20V4h16v16M8 8h2m4 0h2M8 12h2m4 0h2m-6 8v-4h4v4M2 20h20",
    sanitation: "M3 8h11v10H3zM14 11h4l3 3v4h-7M6 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[id]} />
    </svg>
  );
}

export default function HomePage() {
  const [dialog, setDialog] = useState<DialogType>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jobSearch, setJobSearch] = useState("");
  const [jobCountry, setJobCountry] = useState("All Gulf Countries");
  const [jobCategory, setJobCategory] = useState("All Job Categories");
  const [appointment, setAppointment] = useState<{
    serviceType: AppointmentType;
    target: string;
  } | null>(null);
  const [jobApplication, setJobApplication] = useState<{
    title: string;
    destination: string;
  } | null>(null);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [applicationNotice, setApplicationNotice] = useState("");
  const jobCountries = useMemo(
    () => ["All Gulf Countries", ...new Set(jobListings.map((job) => job.destination.split(" · ")[0]))],
    [],
  );
  const jobCategories = useMemo(
    () => ["All Job Categories", ...new Set(jobListings.map((job) => job.role))],
    [],
  );
  const filteredJobs = useMemo(() => jobListings.filter((job) => {
    const matchesCountry = jobCountry === "All Gulf Countries" || job.destination.startsWith(jobCountry);
    const matchesCategory = jobCategory === "All Job Categories" || job.role === jobCategory;
    const matchesSearch = `${job.title} ${job.destination} ${job.requirements}`
      .toLowerCase()
      .includes(jobSearch.trim().toLowerCase());
    return matchesCountry && matchesCategory && matchesSearch;
  }), [jobCategory, jobCountry, jobSearch]);

  function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const message = [
      `Hello Youamy Enterprises, my name is ${String(formData.get("name"))}.`,
      `My phone number is ${String(formData.get("phone"))}.`,
      email ? `My email address is ${email}.` : "",
      `I am enquiring about ${String(formData.get("service"))}.`,
      String(formData.get("message")),
    ].join(" ");

    window.location.assign(whatsappLink(message));
  }

  async function submitJobApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jobApplication) return;
    setApplicationBusy(true);
    setApplicationError("");
    setApplicationNotice("");
    const formData = new FormData(event.currentTarget);
    formData.set("jobTitle", jobApplication.title);
    formData.set("destination", jobApplication.destination);
    try {
      const response = await fetch("/api/job-applications", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your application.");
      setApplicationNotice(result.notice);
      event.currentTarget.reset();
    } catch (reason) {
      setApplicationError(reason instanceof Error ? reason.message : "Could not submit your application.");
    } finally {
      setApplicationBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="contact-strip">
        <div className="site-container strip-content">
          <a href={`tel:${company.phoneLink}`}>{company.phone}</a>
          <span className="strip-divider" aria-hidden="true">
            /
          </span>
          <a href={`mailto:${company.email}`}>{company.email}</a>
          <span className="strip-location">Licensed Recruitment · Auto · Real Estate · Sanitation</span>
        </div>
      </div>

      <header className="site-header">
        <div className="site-container header-content">
          <a className="brand" href="#home" aria-label="Youamy Enterprises home">
            <Image
              className="brand-logo"
              src="/yel-logo.jpg"
              alt="Youamy Enterprises Limited logo"
              width={78}
              height={58}
              priority
            />
            <span className="brand-copy">
              <span className="brand-youamy">YOUAMY</span>
              <span className="brand-enterprises">ENTERPRISES</span>
              <span className="brand-limited">LIMITED · MULTI-SERVICE GROUP</span>
            </span>
          </a>

          <nav
            className={`main-nav${mobileMenuOpen ? " main-nav-open" : ""}`}
            aria-label="Main navigation"
          >
            {navigation.map(([label, href]) => (
              <a
                href={href}
                key={href}
                onClick={() => setMobileMenuOpen(false)}
              >
                {label}
              </a>
            ))}
            <Link
              className="nav-action nav-action-mobile"
              href="/cart"
              onClick={() => setMobileMenuOpen(false)}
            >
              Cart
            </Link>
            <Link
              className="nav-action nav-action-mobile nav-signin-mobile"
              href="/sign-in"
              onClick={() => setMobileMenuOpen(false)}
            >
              Client sign in
            </Link>
          </nav>

          <div className="header-actions">
            <Link
              className="nav-action cart-action"
              href="/cart"
            >
              Cart
            </Link>
            <Link
              className="nav-action sign-in-action"
              href="/sign-in"
            >
              Client sign in
            </Link>
            <button
              className="menu-toggle"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <section className="hero" id="home">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">
              ✦ &nbsp; ONE COMPANY · FOUR CORE DIVISIONS
            </p>
            <h1>
              Empowering Careers,
              <span>Mobility, Property &amp; Clean Communities.</span>
            </h1>
            <p className="hero-intro">
              Welcome to Youamy Enterprises Limited—your premier gateway to
              verified Gulf employment, quality motor vehicles, prime real
              estate investments, and professional sanitation services.
            </p>
            <div className="hero-actions">
              <a className="button button-primary" href="#jobs">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6V4.8A1.8 1.8 0 0 1 10.8 3h2.4A1.8 1.8 0 0 1 15 4.8V6m-12 4h18M5 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
                </svg>
                Explore Gulf Jobs
              </a>
              <a className="button button-violet" href="#vehicles">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m3 13.5 2.2-6.5h12.6l3.2 6.5V19h-2.2a2.3 2.3 0 0 1-4.6 0H9.8a2.3 2.3 0 0 1-4.6 0H3v-5.5Zm2.2-1h13.9M5.2 16.7h.1m13.7 0h.1" />
                </svg>
                Browse Vehicles
              </a>
              <button
                className="button button-outline"
                onClick={() => setDialog("tracking")}
              >
                Track Application
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="divisions-section" aria-labelledby="divisions-heading">
        <div className="site-container">
          <h2 className="sr-only" id="divisions-heading">Explore YEL divisions</h2>
          <div className="division-grid grid grid-cols-2 gap-3 md:grid-cols-4">
            {divisions.map((division) => (
              <a
                className={`division-card division-${division.color}`}
                href={`#${division.id}`}
                key={division.id}
              >
                <span className="division-count">{division.count}</span>
                <span className="division-icon" aria-hidden="true">
                  <DivisionGlyph id={division.id} />
                </span>
                <h3>{division.name}</h3>
                <p>{division.description}</p>
                <span className="division-link">
                  Open Division <span aria-hidden="true">›</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="featured-section jobs-section" id="jobs">
        <div className="site-container">
          <div className="recruitment-banner">
            <p className="recruitment-eyebrow">Overseas manpower placement</p>
            <h2>Gulf Recruitment Portal</h2>
            <p>Apply for verified jobs across Saudi Arabia, Qatar, UAE, Oman and Kuwait. Our team will guide you through the application and visa process.</p>
            <div className="recruitment-country-tabs" aria-label="Filter jobs by country">
              {jobCountries.map((country) => (
                <button
                  type="button"
                  className={jobCountry === country ? "active" : ""}
                  aria-pressed={jobCountry === country}
                  key={country}
                  onClick={() => setJobCountry(country)}
                >
                  {country}
                </button>
              ))}
            </div>
          </div>

          <div className="recruitment-filters">
            <label className="recruitment-search">
              <span className="sr-only">Search jobs</span>
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="10.8" cy="10.8" r="6.8" />
                <path d="m16 16 5 5" />
              </svg>
              <input
                type="search"
                value={jobSearch}
                onChange={(event) => setJobSearch(event.target.value)}
                placeholder="Search job title or city (e.g. Driver, Nurse, Doha, Riyadh)"
              />
            </label>
            <label className="recruitment-category">
              <span className="sr-only">Filter by job category</span>
              <select value={jobCategory} onChange={(event) => setJobCategory(event.target.value)}>
                {jobCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
          </div>

          <div className="recruitment-job-list">
            {filteredJobs.map((listing) => (
              <article className="recruitment-job-card" key={listing.title}>
                <div className="recruitment-job-info">
                  <div className="job-card-top">
                    <span>{listing.destination}</span>
                    <span className="job-category-chip">{listing.role}</span>
                    <span className="job-openings-chip">{listing.openings}</span>
                  </div>
                  <h3>{listing.title}</h3>
                  <p className="job-compensation">
                    Salary &amp; package: {listing.compensation} (Full-time)
                  </p>
                  <p className="job-requirements"><strong>Requirements:</strong> {listing.requirements}</p>
                  <p className="job-benefits">
                    <strong>Benefits:</strong> {listing.role === "Healthcare"
                      ? "Housing allowance, health cover and annual leave."
                      : listing.role === "Security Services"
                        ? "Accommodation, uniform and medical insurance."
                        : "Contract benefits and support from the recruitment team."}
                    <span> · Deadline: {listing.deadline}</span>
                  </p>
                </div>
                <div className="recruitment-job-action">
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => {
                      setApplicationError("");
                      setApplicationNotice("");
                      setJobApplication({
                        title: listing.title,
                        destination: listing.destination,
                      });
                    }}
                  >
                    Apply with CV
                  </button>
                  <span>Upload your CV securely with the application.</span>
                </div>
              </article>
            ))}
            {filteredJobs.length === 0 && (
              <div className="recruitment-empty">No jobs match those filters. Try another country or category.</div>
            )}
          </div>
          <a className="text-link recruitment-all-jobs" href="#contact">
            Ask the recruitment team <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section className="inventory-section vehicle-section" id="vehicles">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Auto marketplace</p>
              <h2>Featured Vehicles</h2>
            </div>
            <a className="text-link" href="#contact">
              Ask about a vehicle <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="market-grid">
            {vehicleListings.map((listing) => (
              <article className="market-card" key={listing.title}>
                <PhotoSlider
                  imageUrls={listing.imageUrls}
                  alt={listing.title}
                  status={listing.status}
                  className="vehicle-photo"
                />
                <div className="market-card-content">
                  <p className="listing-category">{listing.year}</p>
                  <h3>{listing.title}</h3>
                  <p className="market-price">{listing.price}</p>
                  <p className="market-details">{listing.details}</p>
                  <div className="listing-actions">
                    <a
                      className="listing-contact listing-whatsapp"
                      href={whatsappLink(
                        `Hello Youamy Enterprises, I am enquiring about ${listing.title}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Inquire via WhatsApp
                    </a>
                    <a
                      className="listing-contact listing-email"
                      href={emailLink(listing.title)}
                    >
                      Inquire via Email
                    </a>
                    <button
                      type="button"
                      className="listing-contact listing-schedule"
                      onClick={() => setAppointment({
                        serviceType: "vehicle_inspection",
                        target: listing.title,
                      })}
                    >
                      Schedule inspection
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="inventory-section property-section" id="real-estate">
        <div className="site-container">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Real estate portfolio</p>
              <h2>Featured Properties</h2>
            </div>
            <a className="text-link" href="#contact">
              Ask about a property <span aria-hidden="true">→</span>
            </a>
          </div>
          <div className="market-grid">
            {propertyListings.map((listing, index) => (
              <article className="market-card" key={listing.title}>
                <PhotoSlider
                  imageUrls={listing.imageUrls}
                  alt={listing.title}
                  status={listing.status}
                  className={`property-photo property-photo-${index + 1}`}
                />
                <div className="market-card-content">
                  <p className="listing-category">{listing.location}</p>
                  <h3>{listing.title}</h3>
                  <p className="market-price">{listing.price}</p>
                  <div className="listing-actions">
                    <a
                      className="listing-contact listing-whatsapp"
                      href={whatsappLink(
                        `Hello Youamy Enterprises, I am enquiring about ${listing.title}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Inquire via WhatsApp
                    </a>
                    <a
                      className="listing-contact listing-email"
                      href={emailLink(listing.title)}
                    >
                      Inquire via Email
                    </a>
                    <button
                      type="button"
                      className="listing-contact listing-schedule"
                      onClick={() => setAppointment({
                        serviceType: "property_viewing",
                        target: listing.title,
                      })}
                    >
                      Schedule viewing
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProductBrowser />

      <section className="sanitation-section" id="sanitation">
        <div className="site-container">
          <div className="sanitation-heading">
            <p className="section-kicker">Sanitation services</p>
            <h2>Sanitation &amp; waste management services</h2>
            <p>Fast, licensed and eco-compliant sanitation for homes, estates, hotels and factories.</p>
          </div>
          <div className="sanitation-layout">
            <div className="sanitation-service-list">
              {[
                ["Septic tank cleaning", "Modern high-capacity exhauster trucks for rapid, hygienic septic and biodigester emptying.", "/sanitation/septic-tank-cleaning.jpg"],
                ["Garbage collection", "Reliable weekly residential estate and commercial refuse collection with NEMA compliance.", "/sanitation/garbage-collection.jpg"],
                ["Waste management solutions", "Industrial waste sorting, skip bin rentals and eco-friendly disposal management.", "/sanitation/waste-management.jpg"],
                ["Commercial & residential cleaning", "Deep post-construction cleaning, office janitorial contracts and fumigation services.", "/sanitation/commercial-cleaning.jpg"],
                ["Skip bin & construction waste disposal", "Short-term and project-based skip bins for renovation debris and commercial waste.", "/sanitation/waste-disposal.jpg"],
              ].map(([title, detail, imageUrl]) => (
                <article className="sanitation-service-card" key={title}>
                  <div className="sanitation-service-photo">
                    <Image src={imageUrl} alt={title} fill unoptimized sizes="(max-width: 700px) 100vw, 25vw" />
                  </div>
                  <div className="sanitation-service-content">
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </article>
              ))}
              <aside className="sanitation-emergency">
                <h3>Emergency exhauster dispatch?</h3>
                <p>
                  Call our 24/7 rapid response desk at{" "}
                  <a href={`tel:${company.phoneLink}`}>{company.phone}</a> for same-day septic or waste clearance.
                </p>
              </aside>
            </div>
            <AppointmentBooking serviceType="sanitation_service" />
          </div>
        </div>
      </section>

      {appointment && (
        <AppointmentBooking
          variant="dialog"
          serviceType={appointment.serviceType}
          initialTarget={appointment.target}
          onClose={() => setAppointment(null)}
        />
      )}

      {jobApplication && (
        <div
          className="appointment-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setJobApplication(null);
          }}
        >
          <section className="appointment-dialog job-application-dialog" role="dialog" aria-modal="true" aria-labelledby="job-application-title">
            <button
              type="button"
              className="appointment-dialog-close"
              onClick={() => setJobApplication(null)}
              aria-label="Close job application"
            >
              ×
            </button>
            <form className="appointment-form" onSubmit={submitJobApplication}>
              <div className="appointment-form-heading">
                <h3 id="job-application-title">Apply for this job</h3>
                <p>{jobApplication.title} · {jobApplication.destination}</p>
              </div>
              <div className="appointment-fields">
                <label className="appointment-field">
                  Full name
                  <input name="fullName" autoComplete="name" maxLength={120} required />
                </label>
                <label className="appointment-field">
                  Phone number
                  <input name="phone" type="tel" autoComplete="tel" maxLength={32} required />
                </label>
                <label className="appointment-field">
                  Email address
                  <input name="email" type="email" autoComplete="email" maxLength={180} />
                </label>
                <label className="appointment-field">
                  Relevant experience
                  <input name="experience" maxLength={2000} placeholder="Years and role experience" />
                </label>
                <label className="appointment-field appointment-field-wide">
                  Attach CV or resume
                  <input
                    name="cv"
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                    required
                  />
                  <span className="job-application-file-help">PDF, Word, JPG or PNG. Maximum 5 MB.</span>
                </label>
                <label className="appointment-field appointment-field-wide">
                  Additional information
                  <textarea name="notes" rows={3} maxLength={2000} />
                </label>
              </div>
              {applicationError && <p className="appointment-error" role="alert">{applicationError}</p>}
              {applicationNotice && <p className="appointment-success" role="status">{applicationNotice}</p>}
              <div className="appointment-submit-row">
                <button type="submit" className="appointment-submit" disabled={applicationBusy}>
                  {applicationBusy ? "Submitting…" : "Submit application"}
                </button>
                <button type="button" className="appointment-cancel" onClick={() => setJobApplication(null)}>Close</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="about-faq-section" id="about">
        <div className="site-container about-faq-layout">
          <div className="about-panel">
            <p className="section-kicker">About Youamy Enterprises Limited</p>
            <h2>Built on integrity, reliability and service excellence.</h2>
            <p>
              Youamy Enterprises Limited is a diversified corporate enterprise
              headquartered in Kenya, serving individuals, families and
              commercial institutions across East Africa and the Gulf
              Cooperation Council (GCC) region.
            </p>
            <div className="company-stats" aria-label="Company highlights">
              <article><strong>1,200+</strong><span>Candidates placed in Gulf</span></article>
              <article><strong>450+</strong><span>Verified vehicles sold</span></article>
              <article><strong>98%</strong><span>Client satisfaction score</span></article>
              <article><strong>24/7</strong><span>Sanitation fleet support</span></article>
            </div>
            <div className="about-divisions">
              <span>Gulf overseas recruitment</span>
              <span>Auto marketplace and imports</span>
              <span>Real estate sales and lettings</span>
              <span>Sanitation and waste management</span>
            </div>
            <a className="text-link" href="#contact">
              Contact the YEL team <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="faq-panel" id="faq">
            <p className="section-kicker">Frequently asked questions</p>
            <h2>Answers to common inquiries</h2>
            <div className="faq-list">
              <details className="faq-item" open>
                <summary>Which Gulf countries do you recruit candidates for?</summary>
                <p>
                  We recruit for Saudi Arabia, Qatar, UAE, Oman and Kuwait,
                  with transparent visa tracking.
                </p>
              </details>
              <details className="faq-item">
                <summary>Are vehicles inspected and duty-paid?</summary>
                <p>
                  Ask our team for the inspection and duty status of the
                  specific vehicle before booking or paying.
                </p>
              </details>
              <details className="faq-item">
                <summary>Do you offer residential and commercial sanitation?</summary>
                <p>
                  Yes. Contact us for residential or commercial cleaning,
                  septic exhauster services and waste collection.
                </p>
              </details>
              <details className="faq-item">
                <summary>How can I track my overseas job application?</summary>
                <p>
                  Use Track Application or contact the recruitment team with
                  your application reference.
                </p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="site-container">
          <div className="section-heading contact-heading">
            <div>
              <p className="section-kicker">Talk to the team</p>
              <h2>Visit our offices or send a message</h2>
            </div>
            <p className="section-aside">
            Questions about recruitment documents, vehicle financing,
            property titles or sanitation contracts? Reach out directly.
            </p>
          </div>
          <div className="contact-layout">
            <div className="contact-card">
              <h3>Visit or contact YEL</h3>
              <address>
                {company.address}
              </address>
              <div className="contact-detail">
                <span>Phone</span>
                <a href={`tel:${company.phoneLink}`}>{company.phone}</a>
              </div>
              <div className="contact-detail">
                <span>Email</span>
                <a href={`mailto:${company.email}`}>{company.email}</a>
              </div>
              <div className="contact-detail">
                <span>Website</span>
                <a href={`https://${company.website}`} target="_blank" rel="noreferrer">{company.website}</a>
              </div>
              <div className="office-map">
                <iframe
                  title="Approximate Youamy Enterprises office location in Mombasa CBD"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=39.657%2C-4.052%2C39.679%2C-4.036&layer=mapnik&marker=${officeCoordinates.latitude}%2C${officeCoordinates.longitude}`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <div>
                  <span>Mombasa CBD · approximate office pin</span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${officeCoordinates.latitude}&mlon=${officeCoordinates.longitude}#map=16/${officeCoordinates.latitude}/${officeCoordinates.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open pinned location
                  </a>
                </div>
              </div>
            </div>

            <form className="contact-form" onSubmit={submitEnquiry}>
              <h3>Send an enquiry</h3>
              <p className="form-note">
                Submitting opens WhatsApp with your message addressed to YEL.
              </p>
              <div className="form-fields">
                <label>
                  Your name
                  <input name="name" autoComplete="name" required />
                </label>
                <label>
                  Phone number
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+254"
                    required
                  />
                </label>
                <label className="field-wide">
                  Email address
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
                <label className="field-wide">
                  What do you need?
                  <select name="service" defaultValue="" required>
                    <option value="" disabled>
                      Select a service
                    </option>
                    <option>Jobs and recruitment</option>
                    <option>Vehicle sale or hire</option>
                    <option>Real estate or Airbnb</option>
                    <option>Cleaning and sanitation</option>
                    <option>Other enquiry</option>
                  </select>
                </label>
                <label className="field-wide">
                  Message
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Tell us what you are looking for"
                    required
                  />
                </label>
              </div>
              <button className="button button-primary form-submit" type="submit">
                Continue to WhatsApp
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="site-container">
          <div className="footer-main">
            <div className="footer-brand">
              <a className="brand brand-footer" href="#home">
                <Image
                  className="brand-logo"
                  src="/yel-logo.jpg"
                  alt="Youamy Enterprises Limited logo"
                  width={78}
                  height={58}
                />
                <span className="brand-copy">
                  <span className="brand-youamy">YOUAMY</span>
                  <span className="brand-enterprises">ENTERPRISES</span>
                  <span className="brand-limited">LIMITED · MULTI-SERVICE GROUP</span>
                </span>
              </a>
              <p>{company.tagline}</p>
            </div>
            <div className="footer-column">
              <h3>Business divisions</h3>
              <a href="#jobs">Jobs & recruitment</a>
              <a href="#vehicles">Auto marketplace</a>
              <a href="#real-estate">Real estate</a>
              <a href="#sanitation">Sanitation services</a>
            </div>
            <div className="footer-column">
              <h3>Quick links</h3>
              <a href="#about">About YEL</a>
              <a href="#faq">FAQs</a>
              <a href="#contact">Contact</a>
              <a href="/sign-in">Client sign in</a>
              <a href="/orders">My Orders</a>
              <a href="/admin">Staff admin</a>
            </div>
            <div className="footer-column footer-contact">
              <h3>Head office &amp; contact</h3>
              <span>{company.address}</span>
              <a href={`tel:${company.phoneLink}`}>{company.phone}</a>
              <a href={`mailto:${company.email}`}>{company.email}</a>
              <a href={`https://${company.website}`} target="_blank" rel="noreferrer">{company.website}</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Youamy Enterprises Limited. All rights reserved.</span>
            <span>Recruitment · Auto · Real Estate · Sanitation</span>
          </div>
        </div>
      </footer>

      <a
        className="whatsapp-float"
        href={whatsappLink("Hello Youamy Enterprises, I have a question.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Contact Youamy Enterprises on WhatsApp"
        title="Contact YEL on WhatsApp"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16.1 3A12.9 12.9 0 0 0 5.2 22.5L3.1 29l6.7-2a12.9 12.9 0 1 0 6.3-24Zm0 23.1c-2.1 0-4-.6-5.7-1.7l-.4-.2-4 .1.1-4-.2-.4a10 10 0 1 1 10.2 6.2Zm5.5-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2l-1 1.2c-.2.2-.4.2-.7.1-1.8-.9-3-1.6-4.2-3.7-.3-.5.3-.5.9-1.7.1-.2 0-.5 0-.7l-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.5-.3.3-1.2 1.2-1.2 2.9s1.2 3.4 1.4 3.6c.2.2 2.4 3.7 5.9 5.1 2.2.9 3.1.9 4.2.8.7-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.3-.6-.5Z" />
        </svg>
        <span>WhatsApp Us <strong>({company.phone})</strong></span>
      </a>

      {dialog && (
        <div
          className="dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDialog(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDialog(null);
          }}
          role="presentation"
        >
          <section
            className="dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
          >
            <button
              className="dialog-close"
              autoFocus
              onClick={() => setDialog(null)}
              aria-label="Close dialog"
            >
              ×
            </button>
            {dialog === "cart" ? (
              <>
                <span className="dialog-icon" aria-hidden="true">⌑</span>
                <h2 id="dialog-title">Your cart</h2>
                <p>
                  Cart and checkout are planned for a later stage. For now,
                  contact YEL directly to ask about a listing.
                </p>
                <a
                  className="button button-primary dialog-button"
                  href="#contact"
                  onClick={() => setDialog(null)}
                >
                  Contact YEL
                </a>
              </>
            ) : dialog === "tracking" ? (
              <>
                <span className="dialog-icon" aria-hidden="true">↗</span>
                <h2 id="dialog-title">Application tracking</h2>
                <p>
                  Application tracking is not connected yet. Contact the YEL
                  team for help with an enquiry.
                </p>
                <a
                  className="button button-primary dialog-button"
                  href={whatsappLink("Hello Youamy Enterprises, I need help tracking an application.")}
                  target="_blank"
                  rel="noreferrer"
                >
                  Contact YEL on WhatsApp
                </a>
              </>
            ) : (
              <>
                <span className="dialog-icon" aria-hidden="true">Y</span>
                <h2 id="dialog-title">Client accounts</h2>
                <p>
                  Sign-in with Google, email and phone will be added in Stage 2.
                  Your account details are not collected on this page.
                </p>
                <button
                  className="button button-blue dialog-button"
                  onClick={() => setDialog(null)}
                >
                  Continue browsing
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
