"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { company, whatsappLink } from "@/components/site-data";

type ChatCard = {
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  actionLabel: string;
};

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
  cards?: ChatCard[];
};

const PUBLIC_SUGGESTIONS = [
  "Gulf jobs open now",
  "Estimate septic tank quote",
  "Vehicles & Prado hire",
  "Short-stay apartments",
  "M-Pesa checkout help",
];

const ADMIN_SUGGESTIONS = [
  "Show pending queue summary",
  "How do job slots sync?",
  "Order status rules",
  "How to enable 2FA?",
];

function renderFormattedText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={idx}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={idx}>{part}</span>
    ),
  );
}

export default function PlatformChatbot() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isAdmin = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";

  const [open, setOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>(
    isAdmin ? ADMIN_SUGGESTIONS : PUBLIC_SUGGESTIONS,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSuggestions(isAdmin ? ADMIN_SUGGESTIONS : PUBLIC_SUGGESTIONS);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: isAdmin
          ? "Hi! I am your **Admin Copilot**. Ask for a live operations summary, jump to any tab, or check job-slot & order rules."
          : "Hello! I am **Youamy Assistant**. Ask me about Gulf jobs, vehicles & Prado hire, real estate, instant sanitation quotes, M-Pesa checkout, or paste a `YEL-` tracking code.",
      },
    ]);
  }, [isAdmin]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 420);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, messages, busy]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (isAdminLogin) return null;

  async function sendMessage(textToSend: string) {
    const trimmed = textToSend.trim();
    if (!trimmed || busy) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, pathname }),
      });
      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: data.reply || data.error || "How else can I help?",
          cards: Array.isArray(data.cards) ? data.cards : undefined,
        },
      ]);
      if (Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `Could not reach live assistant right now. You can call us on **${company.phone}** or chat on WhatsApp.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleCardClick(href: string) {
    if (href.startsWith("#admin-")) {
      const section = href.replace("#admin-", "");
      window.dispatchEvent(
        new CustomEvent("youamy-admin-navigate", { detail: { section } }),
      );
      if (window.innerWidth < 640) setOpen(false);
      return;
    }
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    if (href.startsWith("/#") && pathname === "/") {
      const id = href.slice(2);
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      if (window.innerWidth < 640) setOpen(false);
      return;
    }
    router.push(href);
    if (window.innerWidth < 640) setOpen(false);
  }

  return (
    <>
      {open && (
        <section
          className="chatbot-panel"
          role="dialog"
          aria-label={isAdmin ? "Youamy Admin Copilot" : "Youamy Assistant"}
        >
          <header className="chatbot-head">
            <div className="chatbot-head-identity">
              <span className="chatbot-avatar" aria-hidden="true">
                {isAdmin ? "AI" : "Y"}
              </span>
              <div>
                <strong>{isAdmin ? "Admin Copilot" : "Youamy Assistant"}</strong>
                <span>
                  <i className="chatbot-live-dot" aria-hidden="true" />
                  {isAdmin ? "Operations & quick jump" : "Live across all 4 divisions"}
                </span>
              </div>
            </div>
            <div className="chatbot-head-actions">
              {!isAdmin && (
                <a
                  href={whatsappLink("Hello Youamy Enterprises, I was chatting with your assistant and need help.")}
                  target="_blank"
                  rel="noreferrer"
                  className="chatbot-wa-mini"
                  title="Continue on WhatsApp"
                >
                  WhatsApp
                </a>
              )}
              <button
                type="button"
                className="chatbot-close"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                ×
              </button>
            </div>
          </header>

          <div className="chatbot-messages" ref={listRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`chatbot-msg chatbot-msg-${msg.role}`}>
                <div className="chatbot-bubble">
                  <p>{renderFormattedText(msg.text)}</p>
                  {msg.cards && msg.cards.length > 0 && (
                    <div className="chatbot-cards">
                      {msg.cards.map((card, i) => (
                        <button
                          key={`${msg.id}-c-${i}`}
                          type="button"
                          className="chatbot-card"
                          onClick={() => handleCardClick(card.href)}
                        >
                          <div>
                            <strong>{card.title}</strong>
                            <span>{card.subtitle}</span>
                            {card.meta && <small>{card.meta}</small>}
                          </div>
                          <em>{card.actionLabel} →</em>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="chatbot-msg chatbot-msg-assistant" aria-label="Thinking">
                <div className="chatbot-bubble chatbot-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="chatbot-suggestions" aria-label="Suggested prompts">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="chatbot-chip"
                disabled={busy}
                onClick={() => void sendMessage(s)}
              >
                {s}
              </button>
            ))}
          </div>

          <form className="chatbot-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isAdmin ? "Ask summary, slots, orders…" : "Ask about jobs, quotes, YEL- code…"}
              aria-label="Message assistant"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send message">
              Send
            </button>
          </form>
        </section>
      )}

      <div
        className={`platform-dock${isAdmin ? " platform-dock-admin" : ""}${open ? " is-open" : ""}`}
        aria-label="Quick help and navigation"
      >
        {showBackToTop && !isAdmin && (
          <button
            type="button"
            className="back-to-top-pill"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
            title="Scroll back to top"
          >
            ↑
          </button>
        )}

        {!isAdmin && (
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
            <span className="whatsapp-label">WhatsApp <strong>({company.phone})</strong></span>
          </a>
        )}

        <button
          type="button"
          className={`chatbot-launcher${open ? " active" : ""}`}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label={open ? "Close assistant" : isAdmin ? "Open Admin Copilot" : "Open Youamy Assistant"}
        >
          <span className="chatbot-launcher-icon" aria-hidden="true">
            {open ? "×" : "💬"}
          </span>
          <span className="chatbot-launcher-text">
            {open ? "Close" : isAdmin ? "Copilot" : "Ask YEL"}
          </span>
        </button>
      </div>
    </>
  );
}
