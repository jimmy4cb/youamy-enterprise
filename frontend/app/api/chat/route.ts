import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getSessionUser } from "@backend/lib/admin-auth";
import {
  calculateSanitationQuote,
  getAdminOverviewMetrics,
} from "@backend/lib/business-logic";
import { parseJsonValue, queryOne, queryRows } from "@backend/lib/mysql";

export const dynamic = "force-dynamic";

type ChatCard = {
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  actionLabel: string;
};

type ChatResponse = {
  reply: string;
  cards?: ChatCard[];
  suggestions: string[];
};

const CODE_REGEX = /\b(YEL-(?:APP|APT|INQ|ORD)-\d{4}-[A-Z0-9]+)\b/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      pathname?: string;
    } | null;
    const rawMessage = String(body?.message || "").trim();
    const pathname = String(body?.pathname || "/");

    if (!rawMessage) {
      return NextResponse.json(
        { error: "Please enter a message." },
        { status: 400 },
      );
    }

    const q = rawMessage.toLowerCase();
    const isAdminRoute = pathname.startsWith("/admin");

    // 1. Admin Copilot mode (only enriches with metrics when admin cookie is valid)
    if (isAdminRoute) {
      const admin = await getSessionUser().catch(() => null);
      if (admin) {
        if (q.includes("summary") || q.includes("overview") || q.includes("metric") || q.includes("today") || q.includes("pending")) {
          const metrics = await getAdminOverviewMetrics();
          return NextResponse.json<ChatResponse>({
            reply: `Here is your live operations snapshot: KES ${metrics.revenueKes.toLocaleString("en-KE")} confirmed revenue (${metrics.paidOrders} paid orders), ${metrics.remainingJobSlots} open Gulf job slots across ${metrics.activeJobs} active roles, ${metrics.newApplications} new job applications, ${metrics.pendingAppointments} pending appointments, and ${metrics.unreadInquiries} unread enquiries.`,
            cards: [
              { title: "Executive Overview", subtitle: `${metrics.activeOrders} active orders · ${metrics.cancelRequests} cancel requests`, href: "#admin-overview", actionLabel: "Open Overview" },
              { title: "Applications Queue", subtitle: `${metrics.newApplications} new CVs waiting review`, href: "#admin-applications", actionLabel: "Review CVs" },
              { title: "Appointments & Dispatch", subtitle: `${metrics.pendingAppointments} pending bookings`, href: "#admin-appointments", actionLabel: "View Schedule" },
              { title: "Customer Inquiries", subtitle: `${metrics.unreadInquiries} unread messages`, href: "#admin-inquiries", actionLabel: "Reply Now" },
            ],
            suggestions: [
              "Show pending queue summary",
              "How do job slots sync?",
              "Order status rules",
              "Press Ctrl+K quick jump",
            ],
          });
        }

        if (q.includes("slot") || q.includes("job") || q.includes("placed")) {
          return NextResponse.json<ChatResponse>({
            reply: "When you move a candidate's application to \"Placed\" inside Applications, the system atomically increments the job's filled slots inside MySQL and automatically closes the posting once all openings are filled. Moving an application out of \"Placed\" restores the slot.",
            cards: [
              { title: "Gulf Jobs Manager", subtitle: "Publish, edit, or close overseas positions", href: "#admin-jobs", actionLabel: "Open Gulf Jobs" },
              { title: "Job Applications", subtitle: "Screen candidates & mark Placed", href: "#admin-applications", actionLabel: "Open Applications" },
            ],
            suggestions: ["Show pending queue summary", "Order status rules", "How to enable 2FA?"],
          });
        }

        if (q.includes("order") || q.includes("status") || q.includes("refund") || q.includes("cancel")) {
          return NextResponse.json<ChatResponse>({
            reply: "Orders follow a strict state machine: Placed → Confirmed → In progress → Completed (or Cancelled from any active step). Unpaid orders cannot enter fulfillment, and cancelling a paid vehicle/property sale automatically restores product stock.",
            cards: [
              { title: "Orders & Payments", subtitle: "Manage order fulfillment & download PDF receipts", href: "#admin-orders", actionLabel: "Open Orders" },
            ],
            suggestions: ["Show pending queue summary", "How do job slots sync?", "How to enable 2FA?"],
          });
        }

        if (q.includes("2fa") || q.includes("totp") || q.includes("staff") || q.includes("security")) {
          return NextResponse.json<ChatResponse>({
            reply: "Staff can enable or disable TOTP 2FA under Staff & 2FA using any authenticator app (Google Authenticator, Authy, 1Password). Super Admins can also create staff accounts with scoped roles and view the full immutable audit log under Rules & Audit.",
            cards: [
              { title: "Staff & 2FA", subtitle: "Manage TOTP security & staff roles", href: "#admin-staff", actionLabel: "Open Staff & 2FA" },
              { title: "Rules & Audit", subtitle: "Pricing rules & full activity log", href: "#admin-settings", actionLabel: "Open Rules & Audit" },
            ],
            suggestions: ["Show pending queue summary", "Order status rules", "Open Shop & Fleet"],
          });
        }

        return NextResponse.json<ChatResponse>({
          reply: `Hi ${admin.name.split(" ")[0]}! Use Ctrl+K (or the Quick Jump bar at the top) to leap directly to any section, search records, or create a job/listing. Ask me for a live queue summary, order rules, or Gulf slot sync help anytime.`,
          cards: [
            { title: "Live Operations Summary", subtitle: "View revenue, new CVs & pending queues", href: "#admin-overview", actionLabel: "Overview" },
            { title: "Manage Orders", subtitle: "Confirm payments & update fulfillment", href: "#admin-orders", actionLabel: "Orders" },
            { title: "Shop & Fleet Inventory", subtitle: "Update pricing, stock & booking modes", href: "#admin-products", actionLabel: "Shop & Fleet" },
          ],
          suggestions: ["Show pending queue summary", "How do job slots sync?", "Order status rules", "How to enable 2FA?"],
        });
      }
    }

    // 2. Direct Tracking Code Lookup (`YEL-APP-`, `YEL-APT-`, `YEL-INQ-`, `YEL-ORD-`)
    const codeMatch = rawMessage.match(CODE_REGEX);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      if (code.startsWith("YEL-APP-")) {
        const app = await queryOne<RowDataPacket>(
          `SELECT tracking_code, job_title, destination, status, created_at FROM job_applications WHERE tracking_code = ? LIMIT 1`,
          [code],
        );
        if (app) {
          return NextResponse.json<ChatResponse>({
            reply: `Application ${app.tracking_code} for "${app.job_title}" (${app.destination}) is currently marked: **${app.status}**.`,
            cards: [{
              title: app.title || app.job_title,
              subtitle: `Status: ${app.status} · ${app.destination}`,
              meta: `Submitted ${new Date(app.created_at).toLocaleDateString("en-KE")}`,
              href: `/?track=${encodeURIComponent(code)}#home`,
              actionLabel: "Open full timeline",
            }],
            suggestions: ["Show active Gulf jobs", "Check another YEL code", "Contact support on WhatsApp"],
          });
        }
      } else if (code.startsWith("YEL-APT-")) {
        const apt = await queryOne<RowDataPacket>(
          `SELECT tracking_code, target, preferred_date, preferred_time, location, estimated_kes, status FROM appointment_requests WHERE tracking_code = ? LIMIT 1`,
          [code],
        );
        if (apt) {
          return NextResponse.json<ChatResponse>({
            reply: `Booking ${apt.tracking_code} for "${apt.target}" at ${apt.location} on ${apt.preferred_date} (${apt.preferred_time}) is currently **${apt.status}**.`,
            cards: [{
              title: apt.target,
              subtitle: `${apt.preferred_date} ${apt.preferred_time} · Status: ${apt.status}`,
              meta: apt.estimated_kes ? `Estimate: KES ${Number(apt.estimated_kes).toLocaleString("en-KE")}` : undefined,
              href: `/?track=${encodeURIComponent(code)}#home`,
              actionLabel: "View booking details",
            }],
            suggestions: ["Estimate septic exhauster price", "Browse vehicles & car hire", "Contact support"],
          });
        }
      } else if (code.startsWith("YEL-INQ-")) {
        const inq = await queryOne<RowDataPacket>(
          `SELECT tracking_code, subject, division, status, created_at FROM inquiries WHERE tracking_code = ? LIMIT 1`,
          [code],
        );
        if (inq) {
          return NextResponse.json<ChatResponse>({
            reply: `Inquiry ${inq.tracking_code} (${inq.division} — "${inq.subject}") currently has status **${inq.status}**.`,
            cards: [{
              title: inq.subject,
              subtitle: `${inq.division} · Status: ${inq.status}`,
              href: `/?track=${encodeURIComponent(code)}#home`,
              actionLabel: "Open tracker",
            }],
            suggestions: ["Explore Gulf jobs", "Browse Real Estate", "Sanitation services"],
          });
        }
      } else if (code.startsWith("YEL-ORD-")) {
        const ord = await queryOne<RowDataPacket>(
          `SELECT id, order_number, status, payment_status, total_amount, created_at FROM orders WHERE order_number = ? LIMIT 1`,
          [code],
        );
        if (ord) {
          return NextResponse.json<ChatResponse>({
            reply: `Order ${ord.order_number} (KES ${Number(ord.total_amount).toLocaleString("en-KE")}) is **${ord.status}** with payment status **${ord.payment_status}**.`,
            cards: [{
              title: `Order ${ord.order_number}`,
              subtitle: `Status: ${ord.status} · Payment: ${ord.payment_status}`,
              meta: `KES ${Number(ord.total_amount).toLocaleString("en-KE")}`,
              href: `/orders/${ord.id}`,
              actionLabel: "View order / receipt",
            }],
            suggestions: ["Go to My Orders", "M-Pesa checkout help", "Browse Shop"],
          });
        }
      }

      return NextResponse.json<ChatResponse>({
        reply: `I couldn't find a record matching tracking code ${code}. Double-check the reference format (e.g. YEL-APP-2026-XXXXXX, YEL-APT-..., YEL-INQ-..., or YEL-ORD-...) or search by your phone/email in our Status Tracker.`,
        cards: [{
          title: "Open Status Tracker",
          subtitle: "Search by tracking code, phone number, or email",
          href: "/#home",
          actionLabel: "Track Status",
        }],
        suggestions: ["Show open Gulf jobs", "Browse Shop & Rentals", "Sanitation quote estimate"],
      });
    }

    // 3. Track intent without code
    if (q.includes("track") || q.includes("status") || q.includes("where is my")) {
      return NextResponse.json<ChatResponse>({
        reply: "You can paste your tracking code right here in chat (like YEL-APP-2026-XXXXXX, YEL-APT-..., YEL-INQ-..., or YEL-ORD-...) for an instant lookup, or open the Status Tracker with your phone number or email.",
        cards: [
          { title: "My Orders & Receipts", subtitle: "Signed-in clients can view full timelines & PDFs", href: "/orders", actionLabel: "Open My Orders" },
          { title: "Public Status Tracker", subtitle: "Look up any application, appointment, or enquiry", href: "/#home", actionLabel: "Go to Tracker" },
        ],
        suggestions: ["Show open Gulf jobs", "Browse car hire rates", "Sanitation quote estimate"],
      });
    }

    // 4. Gulf Recruitment intent
    if (
      q.includes("job") || q.includes("gulf") || q.includes("work") || q.includes("recruit") ||
      q.includes("visa") || q.includes("saudi") || q.includes("qatar") || q.includes("uae") ||
      q.includes("dubai") || q.includes("oman") || q.includes("kuwait") || q.includes("driver") ||
      q.includes("nurse") || q.includes("hospitality") || q.includes("security") || q.includes("technician")
    ) {
      const jobs = await queryRows<RowDataPacket>(
        `SELECT id, title, destination_country, destination_city, role_category, compensation_display, openings_total, openings_filled, deadline
         FROM jobs WHERE status = 'Published' ORDER BY featured DESC, id ASC`,
      );
      const filtered = jobs.filter((j) => {
        const text = `${j.title} ${j.destination_country} ${j.destination_city} ${j.role_category}`.toLowerCase();
        const terms = ["saudi", "qatar", "uae", "dubai", "oman", "kuwait", "driver", "nurse", "hospitality", "security", "technician", "construction"];
        const matchedTerms = terms.filter((t) => q.includes(t));
        return matchedTerms.length === 0 || matchedTerms.some((t) => text.includes(t));
      });
      const shown = (filtered.length > 0 ? filtered : jobs).slice(0, 4);
      const totalSlots = jobs.reduce((s, j) => s + Math.max(0, Number(j.openings_total) - Number(j.openings_filled)), 0);

      return NextResponse.json<ChatResponse>({
        reply: `We currently have ${jobs.length} active GCC recruitment roles with ${totalSlots} openings remaining across Saudi Arabia, Qatar, UAE, Oman, and Kuwait. You can apply online with a PDF/DOCX CV and receive a tracking code immediately:`,
        cards: shown.map((j) => {
          const left = Math.max(0, Number(j.openings_total) - Number(j.openings_filled));
          return {
            title: String(j.title),
            subtitle: `${j.destination_country} · ${j.destination_city} · ${j.compensation_display}`,
            meta: `${left} openings left`,
            href: "/#jobs",
            actionLabel: "Apply with CV",
          };
        }),
        suggestions: ["How do I apply with my CV?", "Track my YEL application", "Explore Vehicles & Car Hire", "Contact recruitment desk"],
      });
    }

    // 5. Sanitation & Exhauster Quote intent
    if (
      q.includes("sanitation") || q.includes("septic") || q.includes("exhauster") || q.includes("garbage") ||
      q.includes("skip bin") || q.includes("waste") || q.includes("clean") || q.includes("quote") || q.includes("estimate")
    ) {
      const serviceName = q.includes("garbage")
        ? "Garbage Collection"
        : q.includes("skip")
          ? "Skip Bin & Construction Waste Disposal"
          : q.includes("waste")
            ? "Waste Management Solutions"
            : q.includes("clean") && !q.includes("septic")
              ? "Commercial & Residential Cleaning"
              : "Septic Tank Cleaning (Exhauster)";

      const capacityTier = q.includes("large") || q.includes("10000") || q.includes("commercial")
        ? "large"
        : q.includes("small")
          ? "small"
          : "medium";
      const frequency = q.includes("month") ? "monthly" : q.includes("week") ? "weekly" : "one_off";
      const urgency = q.includes("urgent") || q.includes("emergency") || q.includes("today") || q.includes("same day")
        ? "emergency"
        : "standard";

      const quote = calculateSanitationQuote({ serviceName, capacityTier, frequency, urgency });

      const packages = await queryRows<RowDataPacket>(
        `SELECT id, title, amount_kes, price_unit, location FROM products WHERE division = 'Sanitation' AND status = 'available' LIMIT 3`,
      );

      return NextResponse.json<ChatResponse>({
        reply: `Instant estimate for **${serviceName}** (${capacityTier} capacity, ${frequency.replace("_", "-")}${urgency === "emergency" ? ", urgent dispatch" : ""}): **KES ${quote.estimatedKes.toLocaleString("en-KE")}**. You can pin your exact GPS location on our interactive map for same-day dispatch or book a fixed sanitation package online:`,
        cards: [
          {
            title: `Book ${serviceName}`,
            subtitle: "Pin exact estate / building on interactive map",
            meta: `Estimated KES ${quote.estimatedKes.toLocaleString("en-KE")}`,
            href: "/#sanitation",
            actionLabel: "Pin Location & Book",
          },
          ...packages.slice(0, 2).map((p) => ({
            title: String(p.title),
            subtitle: `${p.location || "Mombasa / Nairobi"}`,
            meta: `KES ${Number(p.amount_kes).toLocaleString("en-KE")} / ${String(p.price_unit).replace("per_", "")}`,
            href: "/#shop",
            actionLabel: "Book Online",
          })),
        ],
        suggestions: ["Emergency septic cleaning cost", "Monthly estate garbage plan", "7-day skip bin rental", "Book sanitation service"],
      });
    }

    // 6. Vehicles & Car Hire intent
    if (
      q.includes("car") || q.includes("vehicle") || q.includes("prado") || q.includes("mercedes") ||
      q.includes("isuzu") || q.includes("truck") || q.includes("suv") || q.includes("hire") || q.includes("auto")
    ) {
      const vehicles = await queryRows<RowDataPacket>(
        `SELECT title, location, amount_kes, price_unit, status, purchasable FROM products WHERE division = 'Vehicles' AND status <> 'archived' ORDER BY featured DESC LIMIT 4`,
      );
      return NextResponse.json<ChatResponse>({
        reply: "Here are our current verified vehicles and executive hire options across Mombasa & Nairobi. You can add direct purchases or daily Prado hire directly to your cart, or book an inspection:",
        cards: vehicles.map((v) => ({
          title: String(v.title),
          subtitle: `${v.location || "Kenya"} · ${v.status === "available" ? "Available" : v.status}`,
          meta: `KES ${Number(v.amount_kes).toLocaleString("en-KE")}${v.price_unit === "per_day" ? " / day" : ""}`,
          href: v.purchasable ? "/#shop" : "/#vehicles",
          actionLabel: v.purchasable ? "View in Shop" : "Book Inspection",
        })),
        suggestions: ["Book Prado executive hire", "Inspect a vehicle in person", "M-Pesa checkout help", "Browse Real Estate"],
      });
    }

    // 7. Real Estate & Short Stays intent
    if (
      q.includes("property") || q.includes("real estate") || q.includes("villa") || q.includes("apartment") ||
      q.includes("short stay") || q.includes("airbnb") || q.includes("kilimani") || q.includes("nyali") ||
      q.includes("warehouse") || q.includes("rent") || q.includes("home")
    ) {
      const props = await queryRows<RowDataPacket>(
        `SELECT title, location, amount_kes, price_unit, status, purchasable FROM products WHERE division = 'Real Estate' AND status <> 'archived' ORDER BY featured DESC LIMIT 4`,
      );
      return NextResponse.json<ChatResponse>({
        reply: "Our Real Estate division covers coastal villas in Nyali, furnished short-stay apartments in Kilimani, and commercial warehouses along Mombasa Road:",
        cards: props.map((p) => ({
          title: String(p.title),
          subtitle: `${p.location || "Kenya"} · ${p.status}`,
          meta: `KES ${Number(p.amount_kes).toLocaleString("en-KE")}${p.price_unit === "per_night" ? " / night" : p.price_unit === "per_month" ? " / month" : ""}`,
          href: p.purchasable ? "/#shop" : "/#real-estate",
          actionLabel: p.purchasable ? "Book Dates Online" : "Schedule Viewing",
        })),
        suggestions: ["Book Kilimani short stay", "Schedule Nyali Villa viewing", "Browse Vehicles", "Contact sales team"],
      });
    }

    // 8. Checkout / Payment / Cart / Receipts / Account intent
    if (
      q.includes("pay") || q.includes("mpesa") || q.includes("m-pesa") || q.includes("card") ||
      q.includes("flutterwave") || q.includes("checkout") || q.includes("cart") || q.includes("receipt") ||
      q.includes("sign in") || q.includes("login") || q.includes("account") || q.includes("order")
    ) {
      return NextResponse.json<ChatResponse>({
        reply: "Online purchases, car hires, short stays, and sanitation packages support M-Pesa STK Push and Flutterwave Card checkout. Your cart stays saved locally and syncs once signed in, and paid orders include instant downloadable PDF receipts.",
        cards: [
          { title: "Online Shop & Rentals", subtitle: "Add vehicles, short stays, or sanitation plans", href: "/#shop", actionLabel: "Browse Shop" },
          { title: "Your Cart", subtitle: "Review selected items before payment", href: "/cart", actionLabel: "Open Cart" },
          { title: "Client Sign In", subtitle: "Demo: client@youamyenterprises.com / ClientDemo!2026", href: "/sign-in", actionLabel: "Sign In" },
          { title: "My Orders & PDF Receipts", subtitle: "View live fulfillment progress & download receipts", href: "/orders", actionLabel: "My Orders" },
        ],
        suggestions: ["Browse Shop", "Track a YEL code", "Show open Gulf jobs", "Sanitation quote estimate"],
      });
    }

    // 9. Contact / Location / Help intent
    if (q.includes("contact") || q.includes("phone") || q.includes("whatsapp") || q.includes("email") || q.includes("where") || q.includes("office")) {
      const profileRow = await queryOne<RowDataPacket>(
        `SELECT setting_value FROM site_settings WHERE setting_key = 'company_profile' LIMIT 1`,
      );
      const profile = parseJsonValue<Record<string, string>>(profileRow?.setting_value, {});
      const phone = profile.phone || "0135555550";
      const email = profile.email || "info@youamyenterprises.com";
      const address = profile.address || "Youamy Plaza, Mombasa / Nairobi Corridor, Kenya";
      const wa = profile.whatsapp || "254135555550";

      return NextResponse.json<ChatResponse>({
        reply: `You can reach Youamy Enterprises Limited at **${phone}** or **${email}**. Head Office: ${address}. You can also submit a direct division enquiry below or chat instantly on WhatsApp.`,
        cards: [
          { title: "WhatsApp Direct Desk", subtitle: `Chat with our team on +${wa}`, href: `https://wa.me/${wa}?text=${encodeURIComponent("Hello Youamy Enterprises, I need assistance.")}`, actionLabel: "Open WhatsApp" },
          { title: "Send Online Enquiry", subtitle: "Get an email & YEL-INQ tracking code", href: "/#contact", actionLabel: "Go to Contact Form" },
        ],
        suggestions: ["Show open Gulf jobs", "Vehicles & car hire", "Calculate sanitation quote", "Track YEL status"],
      });
    }

    // 10. Friendly default welcome / router
    return NextResponse.json<ChatResponse>({
      reply: "Welcome to **Youamy Enterprises Limited**! I can help you explore Gulf recruitment jobs, check vehicle prices & Prado hire, browse Kilimani/Nyali real estate, estimate sanitation exhauster costs, pay via M-Pesa/Card, or track any `YEL-...` reference code. What would you like help with?",
      cards: [
        { title: "Gulf Jobs & Recruitment", subtitle: "Saudi, Qatar, UAE, Oman & Kuwait openings", href: "/#jobs", actionLabel: "Explore Jobs" },
        { title: "Online Shop & Instant Bookings", subtitle: "Vehicles, Prado hire, short stays & sanitation", href: "/#shop", actionLabel: "Browse Shop" },
        { title: "Sanitation & Exhauster Dispatch", subtitle: "Instant pricing + live GPS location picker", href: "/#sanitation", actionLabel: "Get Quote" },
        { title: "My Orders & Status", subtitle: "View bookings, alerts & PDF receipts", href: "/orders", actionLabel: "My Orders" },
      ],
      suggestions: [
        "Gulf jobs open now",
        "Estimate septic tank quote",
        "Vehicles & Prado hire",
        "Short-stay apartments",
        "M-Pesa checkout help",
      ],
    });
  } catch (error) {
    console.error("Chat assistant error:", error);
    return NextResponse.json<ChatResponse>({
      reply: "I hit a temporary snag fetching live records, but you can browse all divisions on the page or reach our desk directly at 0135555550.",
      suggestions: ["Explore Gulf jobs", "Browse Shop", "Contact support"],
    });
  }
}
