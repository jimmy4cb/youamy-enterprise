"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import ProductBrowser from "@/components/product-browser";
import AppointmentBooking, { type AppointmentType } from "@/components/appointment-booking";
import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { PanelSkeleton } from "@/components/skeletons";
import {
  company,
  divisions,
  emailLink,
  jobListings as fallbackJobs,
  officeCoordinates,
  propertyListings as fallbackProperties,
  vehicleListings as fallbackVehicles,
  whatsappLink,
} from "@/components/site-data";

type DivisionId = "jobs" | "vehicles" | "real-estate" | "sanitation";

type JobCardItem = {
  id?: number;
  title: string;
  destination: string;
  role: string;
  openings: string;
  openings_count?: number;
  compensation: string;
  requirements: string;
  benefits?: string;
  deadline: string;
};

type VehicleCardItem = {
  id?: string;
  title: string;
  year: string;
  price: string;
  details: string;
  status: string;
  imageUrls: string[];
};

type PropertyCardItem = {
  id?: string;
  title: string;
  location: string;
  price: string;
  status: string;
  imageUrls: string[];
};

type TrackingResult = {
  kind: "job_application" | "appointment" | "inquiry" | "order";
  trackingCode: string;
  title: string;
  subtitle: string;
  status: string;
  detail?: string;
  submittedAt: string;
  timeline?: Array<{ status: string; note: string; createdAt: string }>;
};

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
  const safeUrls = imageUrls.length ? imageUrls : ["/yel-logo.jpg"];
  const previousPhoto = () => {
    setPhotoIndex((current) => (current - 1 + safeUrls.length) % safeUrls.length);
  };
  const nextPhoto = () => {
    setPhotoIndex((current) => (current + 1) % safeUrls.length);
  };

  return (
    <div className={className}>
      <Image
        src={safeUrls[photoIndex]}
        alt={`${alt} photo ${photoIndex + 1}`}
        fill
        unoptimized
        sizes="(max-width: 700px) 100vw, 33vw"
      />
      {safeUrls.length > 1 && (
        <>
          <button type="button" className="photo-slider-button previous" onClick={previousPhoto} aria-label={`Previous photo of ${alt}`}>
            ‹
          </button>
          <button type="button" className="photo-slider-button next" onClick={nextPhoto} aria-label={`Next photo of ${alt}`}>
            ›
          </button>
          <span className="photo-count" aria-label={`Photo ${photoIndex + 1} of ${safeUrls.length}`}>
            {photoIndex + 1} / {safeUrls.length}
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
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackCode, setTrackCode] = useState("");
  const [trackContact, setTrackContact] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const [trackError, setTrackError] = useState("");
  const [trackResults, setTrackResults] = useState<TrackingResult[]>([]);
  const [trackSearched, setTrackSearched] = useState(false);

  const [jobs, setJobs] = useState<JobCardItem[]>(fallbackJobs);
  const [vehicles, setVehicles] = useState<VehicleCardItem[]>(fallbackVehicles);
  const [properties, setProperties] = useState<PropertyCardItem[]>(fallbackProperties);

  const [jobSearch, setJobSearch] = useState("");
  const [jobCountry, setJobCountry] = useState("All Gulf Countries");
  const [jobCategory, setJobCategory] = useState("All Job Categories");
  const [appointment, setAppointment] = useState<{
    serviceType: AppointmentType;
    target: string;
  } | null>(null);
  const [jobApplication, setJobApplication] = useState<{
    id?: number;
    title: string;
    destination: string;
  } | null>(null);
  const [applicationBusy, setApplicationBusy] = useState(false);
  const [applicationError, setApplicationError] = useState("");
  const [applicationNotice, setApplicationNotice] = useState("");
  const [applicationTrackingCode, setApplicationTrackingCode] = useState("");

  const [enquiryBusy, setEnquiryBusy] = useState(false);
  const [enquiryError, setEnquiryError] = useState("");
  const [enquiryNotice, setEnquiryNotice] = useState("");
  const [enquiryWhatsAppUrl, setEnquiryWhatsAppUrl] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTrack = params.get("track");
    if (initialTrack) {
      setTrackCode(initialTrack);
      setTrackingOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(".divisions-section, .jobs-section, .inventory-section, .shop-catalog, .sanitation-section, .about-faq-section, .contact-section"),
    );
    if (!sections.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      sections.forEach((el) => el.classList.add("reveal-visible"));
      return;
    }

    sections.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) {
        el.classList.add("reveal-visible");
      } else {
        el.classList.add("reveal-pending");
      }
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.remove("reveal-pending");
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.01, rootMargin: "0px 0px -10px 0px" },
    );

    sections.forEach((el) => {
      if (el.classList.contains("reveal-pending")) {
        observer.observe(el);
      }
    });

    const revealOnJump = () => {
      sections.forEach((el) => {
        if (el.classList.contains("reveal-pending") && el.getBoundingClientRect().top <= window.innerHeight * 1.05) {
          el.classList.remove("reveal-pending");
          el.classList.add("reveal-visible");
          observer.unobserve(el);
        }
      });
    };
    window.addEventListener("scroll", revealOnJump, { passive: true });
    revealOnJump();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", revealOnJump);
    };
  }, []);

  useEffect(() => {
    fetch("/api/catalog")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (Array.isArray(data.jobs) && data.jobs.length > 0) {
          setJobs(
            data.jobs.map((j: {
              id: number;
              title: string;
              destination_country: string;
              destination_city: string;
              role_category: string;
              openings_remaining: number;
              compensation_display: string;
              requirements: string;
              benefits: string;
              deadline: string;
            }) => ({
              id: j.id,
              title: j.title,
              destination: `${j.destination_country} · ${j.destination_city}`,
              role: j.role_category,
              openings: j.openings_remaining > 0 ? `${j.openings_remaining} openings` : "Positions filled",
              openings_count: j.openings_remaining,
              compensation: j.compensation_display,
              requirements: j.requirements,
              benefits: j.benefits,
              deadline: j.deadline,
            })),
          );
        }
        if (Array.isArray(data.products) && data.products.length > 0) {
          type CatalogProduct = {
            id: string;
            title: string;
            division: string;
            description: string;
            location: string;
            specs?: Record<string, string>;
            image_urls: string[];
            amount_kes: number;
            price_unit: string;
            status: string;
          };
          const dbVehicles = (data.products as CatalogProduct[]).filter((p) => p.division === "Vehicles");
          if (dbVehicles.length > 0) {
            setVehicles(
              dbVehicles.map((v) => ({
                id: v.id,
                title: v.title,
                year: v.specs?.year || v.location || "Verified vehicle",
                price: `Ksh ${Number(v.amount_kes).toLocaleString("en-KE")}${v.price_unit === "per_day" ? " / day" : ""}`,
                details: v.description,
                status: v.status === "available" ? "Available" : v.status,
                imageUrls: v.image_urls?.length ? v.image_urls : ["/vehicles/prado-txl-exterior.jpg"],
              })),
            );
          }
          const dbProperties = (data.products as CatalogProduct[]).filter((p) => p.division === "Real Estate");
          if (dbProperties.length > 0) {
            setProperties(
              dbProperties.map((p) => ({
                id: p.id,
                title: p.title,
                location: p.location || "Kenya",
                price: `Ksh ${Number(p.amount_kes).toLocaleString("en-KE")}${p.price_unit === "per_night" ? " / night" : ""}`,
                status: p.status === "available" ? "Available" : p.status,
                imageUrls: p.image_urls?.length ? p.image_urls : ["/properties/nyali-villa-exterior.jpg"],
              })),
            );
          }
        }
      })
      .catch(() => {});
  }, []);

  const jobCountries = useMemo(
    () => ["All Gulf Countries", ...new Set(jobs.map((job) => job.destination.split(" · ")[0]))],
    [jobs],
  );
  const jobCategories = useMemo(
    () => ["All Job Categories", ...new Set(jobs.map((job) => job.role))],
    [jobs],
  );
  const filteredJobs = useMemo(
    () =>
      jobs.filter((job) => {
        const matchesCountry = jobCountry === "All Gulf Countries" || job.destination.startsWith(jobCountry);
        const matchesCategory = jobCategory === "All Job Categories" || job.role === jobCategory;
        const matchesSearch = `${job.title} ${job.destination} ${job.requirements}`
          .toLowerCase()
          .includes(jobSearch.trim().toLowerCase());
        return matchesCountry && matchesCategory && matchesSearch;
      }),
    [jobs, jobCategory, jobCountry, jobSearch],
  );

  async function runTrackLookup(codeInput?: string, contactInput?: string) {
    const code = (codeInput ?? trackCode).trim();
    const contact = (contactInput ?? trackContact).trim();
    if (!code && !contact) {
      setTrackError("Enter a tracking reference (e.g. YEL-APP-...) or your phone/email.");
      return;
    }
    setTrackBusy(true);
    setTrackError("");
    setTrackSearched(false);
    try {
      const params = new URLSearchParams();
      if (code) params.set("code", code);
      if (contact) params.set("contact", contact);
      const response = await fetch(`/api/track?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not look up status.");
      setTrackResults(data.results || []);
      setTrackSearched(true);
    } catch (reason) {
      setTrackError(reason instanceof Error ? reason.message : "Lookup failed.");
    } finally {
      setTrackBusy(false);
    }
  }

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const fullName = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const service = String(formData.get("service") || "").trim();
    const message = String(formData.get("message") || "").trim();

    setEnquiryBusy(true);
    setEnquiryError("");
    setEnquiryNotice("");

    const waText = [
      `Hello Youamy Enterprises, my name is ${fullName}.`,
      `Phone: ${phone}.`,
      email ? `Email: ${email}.` : "",
      `Enquiry regarding: ${service}.`,
      message,
    ]
      .filter(Boolean)
      .join(" ");
    setEnquiryWhatsAppUrl(whatsappLink(waText));

    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          email,
          division: service,
          subject: service,
          message,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit your enquiry.");
      setEnquiryNotice(
        `Enquiry received (${result.trackingCode}). Our team will reach out shortly, or you can continue directly on WhatsApp below.`,
      );
      form.reset();
    } catch (reason) {
      setEnquiryError(reason instanceof Error ? reason.message : "Could not submit enquiry.");
    } finally {
      setEnquiryBusy(false);
    }
  }

  async function submitJobApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!jobApplication) return;
    setApplicationBusy(true);
    setApplicationError("");
    setApplicationNotice("");
    setApplicationTrackingCode("");
    const formData = new FormData(form);
    if (jobApplication.id) formData.set("jobId", String(jobApplication.id));
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
      setApplicationTrackingCode(result.trackingCode || "");
      form.reset();
    } catch (reason) {
      setApplicationError(reason instanceof Error ? reason.message : "Could not submit your application.");
    } finally {
      setApplicationBusy(false);
    }
  }

  return (
    <main className="min-h-screen">
      <SiteHeader onOpenTrack={() => setTrackingOpen(true)} />

      <section className="hero" id="home">
        <div className="site-container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">✦ &nbsp; ONE COMPANY · FOUR CORE DIVISIONS</p>
            <h1>
              Empowering Careers,
              <span>Mobility, Property &amp; Clean Communities.</span>
            </h1>
            <p className="hero-intro">
              Welcome to Youamy Enterprises Limited—your premier gateway to
              verified Gulf employment, quality motor vehicles, prime real
              estate investments, and professional sanitation services across Kenya &amp; the GCC.
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
                type="button"
                className="button button-outline"
                onClick={() => setTrackingOpen(true)}
              >
                Track Application / Request
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
            </div>
            <p className="hero-note">
              Ready to place an order or arrange a booking? Visit our <a href="#shop" style={{ color: "#efd565", textDecoration: "underline" }}>Online Shop &amp; Rentals</a>.
            </p>
          </div>

          <aside className="hero-art" aria-label="Live YEL highlights">
            <div className="hero-board">
              <div className="board-topline">
                <span className="board-logo">Y</span>
                <span>YOUAMY ENTERPRISES · LIVE OPERATIONS</span>
                <span className="board-dot" aria-hidden="true" />
              </div>
              <div className="board-main">
                <div className="board-main-text">
                  <span>MOMBASA &amp; GCC</span>
                  <strong>Trusted multi-service partner.</strong>
                </div>
                <div className="board-illustration" aria-hidden="true">
                  <div className="illustration-sun" />
                  <div className="illustration-building building-one" />
                  <div className="illustration-building building-two" />
                  <div className="illustration-road" />
                  <div className="illustration-car">YEL</div>
                </div>
              </div>
              <div className="board-tags">
                <span>{jobs.length} Gulf Roles Active</span>
                <span>{vehicles.length} Verified Vehicles</span>
                <span>{properties.length} Prime Properties</span>
                <span>24/7 Sanitation Fleet</span>
              </div>
            </div>
            <div className="hero-art-stamp">
              <span>LICENSED</span>
              <strong>KENYA</strong>
            </div>
          </aside>
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
            <p>
              Apply for verified jobs across Saudi Arabia, Qatar, UAE, Oman and Kuwait. Every submission receives a tracking code for transparent visa &amp; interview progress.
            </p>
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
              <article className="recruitment-job-card" key={`${listing.id ?? listing.title}`}>
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
                    <strong>Benefits:</strong>{" "}
                    {listing.benefits ||
                      (listing.role === "Healthcare"
                        ? "Housing allowance, health cover and annual leave."
                        : listing.role === "Security Services"
                          ? "Accommodation, uniform and medical insurance."
                          : "Contract benefits and support from the recruitment team.")}
                    <span> · Deadline: {listing.deadline}</span>
                  </p>
                </div>
                <div className="recruitment-job-action">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={listing.openings_count === 0}
                    onClick={() => {
                      setApplicationError("");
                      setApplicationNotice("");
                      setApplicationTrackingCode("");
                      setJobApplication({
                        id: listing.id,
                        title: listing.title,
                        destination: listing.destination,
                      });
                    }}
                  >
                    {listing.openings_count === 0 ? "Positions Filled" : "Apply with CV"}
                  </button>
                  <span>Instant CV upload &amp; tracking ID.</span>
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
            {vehicles.map((listing) => (
              <article className="market-card" key={`${listing.id ?? listing.title}`}>
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
            {properties.map((listing, index) => (
              <article className="market-card" key={`${listing.id ?? listing.title}`}>
                <PhotoSlider
                  imageUrls={listing.imageUrls}
                  alt={listing.title}
                  status={listing.status}
                  className={`property-photo property-photo-${(index % 3) + 1}`}
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
              {applicationNotice && (
                <div className="appointment-success" role="status">
                  <p>{applicationNotice}</p>
                  {applicationTrackingCode && (
                    <div className="tracking-code-pill">
                      Tracking Reference: <strong>{applicationTrackingCode}</strong>{" "}
                      <button
                        type="button"
                        className="tracking-inline-link"
                        onClick={() => {
                          setJobApplication(null);
                          setTrackCode(applicationTrackingCode);
                          setTrackingOpen(true);
                          void runTrackLookup(applicationTrackingCode, "");
                        }}
                      >
                        Track status now →
                      </button>
                    </div>
                  )}
                </div>
              )}
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
                  with transparent application and visa tracking.
                </p>
              </details>
              <details className="faq-item">
                <summary>Are vehicles inspected and duty-paid?</summary>
                <p>
                  Every listed unit undergoes mechanical verification and NTSA/KRA clearance checks. You can also schedule a physical inspection directly from any listing card.
                </p>
              </details>
              <details className="faq-item">
                <summary>Do you offer residential and commercial sanitation?</summary>
                <p>
                  Yes. We dispatch exhauster trucks, skip bins, and NEMA-licensed waste management teams across Mombasa and the Nairobi corridor.
                </p>
              </details>
              <details className="faq-item">
                <summary>How can I track my job application, appointment or order?</summary>
                <p>
                  Click <strong>Track Application / Request</strong> at the top of this page and enter your reference code with the phone number or email used for the request, or search using your phone or email.
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
              property titles or sanitation contracts? Submit directly to our desk.
            </p>
          </div>
          <div className="contact-layout">
            <div className="contact-card">
              <h3>Visit or contact YEL</h3>
              <address>{company.address}</address>
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
                  src={`https://www.google.com/maps?q=${officeCoordinates.latitude},${officeCoordinates.longitude}&z=16&output=embed`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <div>
                  <span>Mombasa CBD · approximate office pin</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${officeCoordinates.latitude}%2C${officeCoordinates.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </div>

            <form className="contact-form" onSubmit={submitEnquiry}>
              <h3>Send an enquiry</h3>
              <p className="form-note">
                Enquiries are logged immediately with a tracking code and routed to the right YEL division.
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
                    <option value="Jobs">Jobs and recruitment</option>
                    <option value="Vehicles">Vehicle sale or hire</option>
                    <option value="Real Estate">Real estate or Airbnb</option>
                    <option value="Sanitation">Cleaning and sanitation</option>
                    <option value="General">Other enquiry</option>
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
              {enquiryError && <p className="appointment-error" style={{ marginTop: 14 }} role="alert">{enquiryError}</p>}
              {enquiryNotice && (
                <div className="appointment-success" style={{ marginTop: 14 }} role="status">
                  <p>{enquiryNotice}</p>
                  {enquiryWhatsAppUrl && (
                    <a
                      href={enquiryWhatsAppUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="tracking-inline-link"
                    >
                      Also send via WhatsApp →
                    </a>
                  )}
                </div>
              )}
              <button className="button button-primary form-submit" type="submit" disabled={enquiryBusy}>
                {enquiryBusy ? "Sending enquiry…" : "Submit Enquiry"}
              </button>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter />

      {trackingOpen && (
        <div
          className="dialog-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setTrackingOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTrackingOpen(false);
          }}
          role="presentation"
        >
          <section
            className="dialog-panel tracker-dialog-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tracker-dialog-title"
          >
            <button
              className="dialog-close"
              autoFocus
              onClick={() => setTrackingOpen(false)}
              aria-label="Close tracker"
            >
              ×
            </button>
            <span className="dialog-icon" aria-hidden="true">↗</span>
            <h2 id="tracker-dialog-title">Track application, booking or order</h2>
            <p>
              Enter a reference code and the phone number or email used for the request, or search using your phone number or email.
            </p>
            <form
              className="tracker-form"
              onSubmit={(e) => {
                e.preventDefault();
                void runTrackLookup();
              }}
            >
              <label>
                Reference code
                <input
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  placeholder="YEL-APP-2026-..."
                />
              </label>
              <label>
                Phone number or email used for the request
                <input
                  value={trackContact}
                  onChange={(e) => setTrackContact(e.target.value)}
                  placeholder="+2547... or email@example.com"
                  required={Boolean(trackCode)}
                />
              </label>
              <button type="submit" className="button button-primary" disabled={trackBusy}>
                {trackBusy ? "Searching…" : "Check live status"}
              </button>
            </form>

            {trackBusy && (
              <div style={{ marginTop: 16 }}>
                <PanelSkeleton lines={3} />
              </div>
            )}

            {trackError && <p className="journey-error" style={{ marginTop: 12 }}>{trackError}</p>}

            {!trackBusy && trackSearched && trackResults.length === 0 && !trackError && (
              <p className="tracker-empty">No matching records found. Check your code or contact our desk on WhatsApp.</p>
            )}

            {trackResults.length > 0 && (
              <div className="tracker-results">
                {trackResults.map((item) => (
                  <article className="tracker-card" key={`${item.kind}-${item.trackingCode}`}>
                    <div className="tracker-card-head">
                      <span className="tracker-kind">{item.kind.replace("_", " ")}</span>
                      <span className="tracker-badge">{item.status}</span>
                    </div>
                    <h3>{item.title}</h3>
                    <p className="tracker-sub">{item.trackingCode} · {item.subtitle}</p>
                    {item.detail && <p className="tracker-detail">{item.detail}</p>}
                    {item.timeline && item.timeline.length > 0 && (
                      <ol className="tracker-timeline">
                        {item.timeline.map((ev, idx) => (
                          <li key={idx}>
                            <strong>{ev.status}</strong>
                            <span>{new Date(ev.createdAt).toLocaleString("en-KE")} {ev.note ? `· ${ev.note}` : ""}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
