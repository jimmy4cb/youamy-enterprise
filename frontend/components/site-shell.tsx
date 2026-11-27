"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { company } from "@/components/site-data";
import { cartCount } from "@/lib/cart-store";

type CustomerSummary = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

const navLinks = [
  ["Gulf Jobs", "/#jobs", "jobs"],
  ["Vehicles", "/#vehicles", "vehicles"],
  ["Real Estate", "/#real-estate", "real-estate"],
  ["Shop", "/#shop", "shop"],
  ["Sanitation", "/#sanitation", "sanitation"],
  ["Contact", "/#contact", "contact"],
] as const;

export function SiteHeader({ onOpenTrack }: { onOpenTrack?: () => void }) {
  const pathname = usePathname() || "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [count, setCount] = useState(0);
  const [customer, setCustomer] = useState<CustomerSummary | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("youamy-theme");
    const nextTheme =
      savedTheme === "dark" || savedTheme === "light"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    const syncCount = () => setCount(cartCount());
    syncCount();
    window.addEventListener("storage", syncCount);
    window.addEventListener("youamy-cart-changed", syncCount);

    fetch("/api/shop/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated && data?.customer) {
          setCustomer(data.customer);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("storage", syncCount);
      window.removeEventListener("youamy-cart-changed", syncCount);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const updateScroll = () => {
      raf = 0;
      const y = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0;
      setScrollProgress(progress);
      setScrolled(y > 24);

      if (pathname === "/") {
        const offset = 150;
        let current = "";
        for (const [, , id] of navLinks) {
          const el = document.getElementById(id);
          if (el) {
            const top = el.getBoundingClientRect().top;
            if (top <= offset) current = id;
          }
        }
        setActiveSection(current);
      }
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(updateScroll);
    };

    updateScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  const firstName = customer?.full_name?.trim().split(/\s+/)[0] || "Account";
  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("youamy-theme", nextTheme);
  };

  return (
    <>
      <div className="contact-strip">
        <div className="site-container strip-content">
          <a href={`tel:${company.phoneLink}`}>{company.phone}</a>
          <span className="strip-divider" aria-hidden="true">/</span>
          <a href={`mailto:${company.email}`}>{company.email}</a>
          <span className="strip-location">Licensed Recruitment · Auto · Real Estate · Sanitation</span>
        </div>
      </div>

      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
        <div className="site-container header-content">
          <Link className="brand" href="/" aria-label="Youamy Enterprises home">
            <Image
              className="brand-logo"
              src="/yel-logo.jpg"
              alt="Youamy Enterprises Limited logo"
              width={64}
              height={48}
              priority
            />
            <span className="brand-copy">
              <span className="brand-youamy">YOUAMY</span>
              <span className="brand-enterprises">ENTERPRISES</span>
              <span className="brand-limited">LIMITED · MULTI-SERVICE GROUP</span>
            </span>
          </Link>

          <nav
            className={`main-nav${mobileMenuOpen ? " main-nav-open" : ""}`}
            aria-label="Main navigation"
          >
            {navLinks.map(([label, href, id]) => (
              <Link
                href={href}
                key={href}
                className={pathname === "/" && activeSection === id ? "active-section" : ""}
                onClick={(e) => {
                  setMobileMenuOpen(false);
                  if (pathname === "/") {
                    const target = document.getElementById(id);
                    if (target) {
                      e.preventDefault();
                      target.scrollIntoView({ behavior: "smooth", block: "start" });
                    }
                  }
                }}
              >
                {label}
              </Link>
            ))}
            {onOpenTrack && (
              <button
                type="button"
                className="main-nav-track"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenTrack();
                }}
              >
                Track Status
              </button>
            )}
            <Link
              className="nav-action nav-action-mobile"
              href="/cart"
              onClick={() => setMobileMenuOpen(false)}
            >
              Cart {count > 0 ? `(${count})` : ""}
            </Link>
            {customer ? (
              <Link
                className="nav-action nav-action-mobile nav-signin-mobile"
                href="/orders"
                onClick={() => setMobileMenuOpen(false)}
              >
                {firstName} · My Orders
              </Link>
            ) : (
              <Link
                className="nav-action nav-action-mobile nav-signin-mobile"
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
              >
                Client sign in
              </Link>
            )}
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
                </svg>
              )}
            </button>
            <Link className="nav-action cart-action" href="/cart">
              Cart{count > 0 ? <span className="header-cart-badge">{count}</span> : null}
            </Link>
            {customer ? (
              <Link className="nav-action sign-in-action" href="/orders" title={`Signed in as ${customer.full_name}`}>
                {firstName} · Orders
              </Link>
            ) : (
              <Link className="nav-action sign-in-action" href="/sign-in">
                Sign in
              </Link>
            )}
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
        <div
          className="scroll-progress-track"
          aria-hidden="true"
        >
          <span
            className="scroll-progress-bar"
            style={{ transform: `scaleX(${scrollProgress})` }}
          />
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link className="brand brand-footer" href="/">
              <Image
                className="brand-logo"
                src="/yel-logo.jpg"
                alt="Youamy Enterprises Limited logo"
                width={64}
                height={48}
              />
              <span className="brand-copy">
                <span className="brand-youamy">YOUAMY</span>
                <span className="brand-enterprises">ENTERPRISES</span>
                <span className="brand-limited">LIMITED · MULTI-SERVICE GROUP</span>
              </span>
            </Link>
            <p>{company.tagline}</p>
          </div>
          <div className="footer-column">
            <h3>Business divisions</h3>
            <Link href="/#jobs">Jobs &amp; recruitment</Link>
            <Link href="/#vehicles">Auto marketplace</Link>
            <Link href="/#real-estate">Real estate</Link>
            <Link href="/#sanitation">Sanitation services</Link>
          </div>
          <div className="footer-column">
            <h3>Client &amp; staff</h3>
            <Link href="/cart">Shopping cart</Link>
            <Link href="/orders">My Orders</Link>
            <Link href="/saved">Saved items</Link>
            <Link href="/profile">Account profile</Link>
            <Link href="/sign-in">Client sign in</Link>
            <Link href="/admin">Staff admin</Link>
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
  );
}
