"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import ProductBrowser from "@/components/product-browser";
import {
  company,
  divisions,
  emailLink,
  jobListings,
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
          <div className="section-heading featured-heading">
            <div>
              <p className="section-kicker">International careers</p>
              <h2>Featured Gulf Job Openings</h2>
              <p className="section-description">
                Direct placements to Saudi Arabia, Qatar, UAE, Oman and Kuwait
                with live visa tracking.
              </p>
            </div>
            <a className="text-link" href="#contact">
              Ask about jobs <span aria-hidden="true">→</span>
            </a>
          </div>

          <div className="jobs-grid">
            {jobListings.map((listing) => (
              <article className="job-card" key={listing.title}>
                <div className="job-card-top">
                  <span>{listing.destination}</span>
                  <span>{listing.openings}</span>
                </div>
                <p className="sample-label">{listing.role}</p>
                <h3>{listing.title}</h3>
                <p className="job-compensation">{listing.compensation}</p>
                <p className="job-requirements">{listing.requirements}</p>
                <div className="job-card-bottom">
                  <span>Due: {listing.deadline}</span>
                  <a
                    className="button button-primary"
                    href={whatsappLink(
                      `Hello Youamy Enterprises, I am enquiring about ${listing.title}.`,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Apply Now
                  </a>
                </div>
              </article>
            ))}
          </div>
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
            {vehicleListings.map((listing, index) => (
              <article className="market-card" key={listing.title}>
                <div
                  className={`sample-image vehicle-image vehicle-image-${index + 1}`}
                  role="img"
                  aria-label={`${listing.title} photo`}
                >
                  <span className="photo-placeholder">Vehicle photo</span>
                  <span className="listing-status">{listing.status}</span>
                </div>
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
                <div
                  className={`sample-image property-image property-image-${index + 1}`}
                  role="img"
                  aria-label={`${listing.title} photo`}
                >
                  <span className="photo-placeholder">Property photo</span>
                  <span className="listing-status">{listing.status}</span>
                </div>
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
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ProductBrowser />

      <section className="sanitation-callout" id="sanitation">
        <div className="site-container sanitation-content">
          <div>
            <p className="section-kicker">Sanitation services</p>
            <h2>Sanitation support, day and night.</h2>
            <p>
              Exhauster septic cleaning, scheduled garbage collection and
              commercial waste solutions with 24/7 fleet support.
            </p>
          </div>
          <a className="button button-blue" href="#contact">
            Ask about sanitation
          </a>
        </div>
      </section>

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
              <div className="map-placeholder" aria-label="[Map placeholder]">
                <span className="map-pin" aria-hidden="true">⌖</span>
                <strong>Mombasa</strong>
                <span>[Map placeholder]</span>
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
