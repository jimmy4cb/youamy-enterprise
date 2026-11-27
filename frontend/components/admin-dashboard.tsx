"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import AdminInquiries from "@/components/admin-inquiries";
import AdminAppointments from "@/components/admin-appointments";
import AdminJobApplications from "@/components/admin-job-applications";
import { AdminOverviewSkeleton, AdminTableSkeleton } from "@/components/skeletons";

type AdminSection =
  | "overview"
  | "jobs"
  | "products"
  | "orders"
  | "applications"
  | "appointments"
  | "inquiries"
  | "staff"
  | "settings";

type OverviewMetrics = {
  revenueKes: number;
  paidOrders: number;
  totalOrders: number;
  activeOrders: number;
  cancelRequests: number;
  totalJobs: number;
  activeJobs: number;
  remainingJobSlots: number;
  totalProducts: number;
  availableProducts: number;
  vehiclesCount: number;
  propertiesCount: number;
  totalApplications: number;
  newApplications: number;
  pipelineApplications: number;
  placedApplications: number;
  totalAppointments: number;
  pendingAppointments: number;
  totalInquiries: number;
  unreadInquiries: number;
  recentActivity: Array<{
    id: number;
    actor_name: string;
    action: string;
    entity_type: string;
    details: string;
    created_at: string;
  }>;
};

type JobItem = {
  id: number;
  slug: string;
  title: string;
  destination_country: string;
  destination_city: string;
  role_category: string;
  employer_name: string;
  openings_total: number;
  openings_filled: number;
  compensation_display: string;
  contract_months: number;
  requirements: string;
  benefits: string;
  deadline: string;
  status: "Published" | "Draft" | "Closed" | "Archived";
  applications_count: number;
  created_at: string;
};

type ShopProduct = {
  id: string;
  title: string;
  division: string;
  listing_kind: string;
  description: string;
  location: string;
  image_urls: string[];
  amount_kes: number;
  price_unit: string;
  stock_quantity: number;
  status: string;
  purchasable: boolean;
  booking_kind: "none" | "car" | "short_stay" | "sanitation";
};

type ShopOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  cancel_requested_at: string | null;
  profiles: { full_name: string; phone: string } | null;
  items?: Array<{ title: string; quantity: number; line_total: number; booking_details: Record<string, string> }>;
};

type StaffMember = {
  id: number;
  name: string;
  email: string;
  role: string;
  totp_enabled: boolean;
  active: boolean;
};

const nextOrderStatuses: Record<string, string[]> = {
  "Pending payment": ["Cancelled"],
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["In progress", "Cancelled"],
  "In progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const localImagePresets = [
  "/vehicles/prado-txl-exterior.jpg",
  "/vehicles/hiace-commuter-exterior.jpg",
  "/vehicles/isuzu-frr-truck.jpg",
  "/properties/nyali-villa-exterior.jpg",
  "/properties/kilimani-apartments.jpg",
  "/properties/diani-plot.jpg",
  "/sanitation/septic-tank-cleaning.jpg",
  "/sanitation/garbage-collection.jpg",
];

function nairobiGreeting() {
  const now = new Date();
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const hour = Number(hourStr);
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Intl.DateTimeFormat("en-KE", {
    timeZone: "Africa/Nairobi",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  return { greeting, dateLabel };
}

function Icon({
  name,
}: {
  name: "grid" | "briefcase" | "package" | "orders" | "apps" | "calendar" | "message" | "shield" | "settings" | "plus" | "search" | "logout";
}) {
  const paths: Record<string, string> = {
    grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
    briefcase: "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 8h18v11H3V8Zm8 4h2",
    package: "M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 20V12m0 0 9-5m-9 5L3 7",
    orders: "M6 2h12l2 5v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7l2-5Zm0 5h12M9 11h6",
    apps: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2m2-2h4v4h-4V2Zm-1 11 2 2 4-4",
    calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 3h3m3-3h2",
    message: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
    shield: "M12 2 4 5v6c0 5.5 3.4 10.6 8 12 4.6-1.4 8-6.5 8-12V5l-8-3Z",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.1h-2.6v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L7.6 17l.1-.1A1.7 1.7 0 0 0 8 15a1.7 1.7 0 0 0-1.5-1H6.4v-2.6h.1A1.7 1.7 0 0 0 8 10.3a1.7 1.7 0 0 0-.3-1.9l-.1-.1L9.4 6.5l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.1H15v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1V14h-.1A1.7 1.7 0 0 0 19.4 15Z",
    plus: "M12 5v14M5 12h14",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm5-3 5 5",
    logout: "M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4",
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export default function AdminDashboard({ user }: { user: { name: string; role: string } }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [quickJumpOpen, setQuickJumpOpen] = useState(false);
  const [quickJumpQuery, setQuickJumpQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [jobQuery, setJobQuery] = useState("");
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState<JobItem | null>(null);

  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productDivision, setProductDivision] = useState("All");
  const [productQuery, setProductQuery] = useState("");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);

  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderFilter, setOrderFilter] = useState("All");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [settings, setSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [activityLog, setActivityLog] = useState<Array<{ id: number; actor_name: string; action: string; entity_type: string; details: string; created_at: string }>>([]);

  const { greeting, dateLabel } = useMemo(() => nairobiGreeting(), []);

  const canManageListings = ["super_admin", "listings_admin"].includes(user.role);
  const canManageOrders = ["super_admin", "orders_admin", "support_agent"].includes(user.role);
  const canManageSupport = ["super_admin", "support_agent"].includes(user.role);
  const isSuperAdmin = user.role === "super_admin";

  const refreshOverview = useCallback(() => {
    fetch("/api/admin/overview")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.metrics) setOverview(data.metrics);
      })
      .catch(() => {})
      .finally(() => setLoadingOverview(false));
  }, []);

  const refreshJobs = useCallback(() => {
    if (!canManageListings) {
      setLoadingJobs(false);
      return;
    }
    fetch("/api/admin/jobs")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.jobs) setJobs(data.jobs);
      })
      .catch(() => {})
      .finally(() => setLoadingJobs(false));
  }, [canManageListings]);

  const refreshProducts = useCallback(() => {
    if (!canManageListings) {
      setLoadingProducts(false);
      return;
    }
    fetch("/api/admin/shop/products")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.products) setProducts(data.products);
      })
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [canManageListings]);

  const refreshOrders = useCallback(() => {
    if (!canManageOrders) {
      setLoadingOrders(false);
      return;
    }
    fetch("/api/admin/shop/orders")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.orders) setOrders(data.orders);
      })
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [canManageOrders]);

  const refreshStaffAndSecurity = useCallback(() => {
    fetch("/api/admin/auth/security")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setTotpEnabled(Boolean(data.totpEnabled));
      })
      .catch(() => {});
    if (isSuperAdmin) {
      fetch("/api/admin/staff")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.staff) setStaff(data.staff);
        })
        .catch(() => {});
    }
  }, [isSuperAdmin]);

  const refreshSettings = useCallback(() => {
    fetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
        if (data?.activity) setActivityLog(data.activity);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshOverview();
    refreshJobs();
    refreshProducts();
    refreshOrders();
    refreshStaffAndSecurity();
    refreshSettings();
  }, [refreshJobs, refreshOrders, refreshOverview, refreshProducts, refreshSettings, refreshStaffAndSecurity]);

  useEffect(() => {
    const validSections: AdminSection[] = [
      "overview", "jobs", "products", "orders", "applications", "appointments", "inquiries", "staff", "settings",
    ];
    const onNavigate = (e: Event) => {
      const detail = (e as CustomEvent<{ section?: string }>).detail;
      if (detail?.section && validSections.includes(detail.section as AdminSection)) {
        setSection(detail.section as AdminSection);
        setMobileMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickJumpOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setQuickJumpOpen(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("youamy-admin-navigate", onNavigate);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("youamy-admin-navigate", onNavigate);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  async function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      ...(editingJob ? { id: editingJob.id } : {}),
      title: String(data.get("title") || ""),
      destination_country: String(data.get("destination_country") || ""),
      destination_city: String(data.get("destination_city") || ""),
      role_category: String(data.get("role_category") || ""),
      employer_name: String(data.get("employer_name") || "Verified GCC Partner"),
      openings_total: Number(data.get("openings_total") || 1),
      compensation_display: String(data.get("compensation_display") || ""),
      requirements: String(data.get("requirements") || ""),
      benefits: String(data.get("benefits") || ""),
      deadline: String(data.get("deadline") || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)),
      status: String(data.get("status") || "Published"),
    };
    const res = await fetch("/api/admin/jobs", {
      method: editingJob ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error || "Could not save job.");
      return;
    }
    setShowJobModal(false);
    setEditingJob(null);
    setNotice(editingJob ? "Job updated." : "Job published to Gulf Recruitment Portal.");
    refreshJobs();
    refreshOverview();
  }

  async function addShopProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/shop/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        division: data.get("division"),
        listing_kind: data.get("listing_kind"),
        location: data.get("location"),
        description: data.get("description"),
        amount_kes: Number(data.get("amount_kes")),
        price_unit: data.get("price_unit"),
        stock_quantity: Number(data.get("stock_quantity") || 1),
        image_urls: String(data.get("image_urls") || "").split(/\r?\n/).map((u) => u.trim()).filter(Boolean),
        booking_kind: data.get("booking_kind"),
        purchasable: data.get("purchasable") === "on",
        status: data.get("status") || "available",
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not add product.");
      return;
    }
    setShowProductForm(false);
    setNotice("Product added to catalog & storefront.");
    refreshProducts();
    refreshOverview();
  }

  async function saveShopProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/shop/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        division: data.get("division"),
        listing_kind: data.get("listing_kind"),
        location: data.get("location"),
        description: data.get("description"),
        amount_kes: Number(data.get("amount_kes")),
        price_unit: data.get("price_unit"),
        stock_quantity: Number(data.get("stock_quantity") || 0),
        image_urls: String(data.get("image_urls") || "").split(/\r?\n/).map((u) => u.trim()).filter(Boolean),
        booking_kind: data.get("booking_kind"),
        purchasable: data.get("purchasable") === "on",
        status: data.get("status"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not update product.");
      return;
    }
    setEditingProduct(null);
    setNotice("Product updated.");
    refreshProducts();
    refreshOverview();
  }

  async function updateOrderStatus(order: ShopOrder, status: string) {
    setError("");
    const response = await fetch("/api/admin/shop/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not update order.");
      return;
    }
    setNotice(`Order ${order.order_number} marked ${status}.`);
    refreshOrders();
    refreshOverview();
    refreshProducts();
  }

  async function confirmOrderPayment(order: ShopOrder) {
    const ref = window.prompt(`Enter M-Pesa / Bank reference for ${order.order_number} (optional):`) || undefined;
    setError("");
    const response = await fetch("/api/admin/shop/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, action: "confirm_manual_payment", transactionRef: ref }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not confirm payment.");
      return;
    }
    setNotice(`Payment confirmed for ${order.order_number}.`);
    refreshOrders();
    refreshOverview();
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.get("name"),
        email: data.get("email"),
        password: data.get("password"),
        role: data.get("role"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error || "Could not create staff account.");
      return;
    }
    setShowStaffForm(false);
    setNotice("Staff account created.");
    refreshStaffAndSecurity();
  }

  async function toggleStaffActive(member: StaffMember) {
    const res = await fetch("/api/admin/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, active: !member.active }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not update staff account.");
      return;
    }
    setNotice(`${member.name} ${member.active ? "deactivated" : "activated"}.`);
    refreshStaffAndSecurity();
  }

  async function setupTotp() {
    setError("");
    const res = await fetch("/api/admin/auth/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    });
    const data = await res.json();
    if (res.ok) setTotpSecret(data.secret);
    else setError(data.error || "Could not start 2FA setup.");
  }

  async function enableTotp(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "enable", code: totpCode }),
    });
    const data = await res.json();
    if (res.ok) {
      setTotpEnabled(true);
      setTotpSecret("");
      setTotpCode("");
      setNotice("Two-factor authentication enabled on your account.");
    } else {
      setError(data.error || "Invalid authenticator code.");
    }
  }

  async function disableTotp() {
    const res = await fetch("/api/admin/auth/security", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disable" }),
    });
    if (res.ok) {
      setTotpEnabled(false);
      setNotice("Two-factor authentication disabled.");
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await fetch("/api/admin/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "Could not change your password.");
        return;
      }
      form.reset();
      setNotice("Password updated successfully.");
    } catch {
      setError("Network error while changing your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function saveBusinessRules(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const rules = {
      sanitation_septic_kes: Number(data.get("septic_kes") || 12000),
      sanitation_garbage_kes: Number(data.get("garbage_kes") || 3500),
      sanitation_skipbin_kes: Number(data.get("skipbin_kes") || 18000),
      sanitation_commercial_kes: Number(data.get("commercial_kes") || 15000),
      maxAppointmentsPerSlot: Number(data.get("max_per_slot") || 3),
      cancellationWindowHours: Number(data.get("cancel_hours") || 24),
    };
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settingKey: "business_rules", settingValue: rules }),
    });
    if (res.ok) {
      setNotice("Business rules saved to the database.");
      refreshSettings();
    } else {
      setError("Could not update settings.");
    }
  }

  const filteredJobs = useMemo(
    () =>
      jobs.filter((j) =>
        `${j.title} ${j.destination_country} ${j.destination_city} ${j.role_category}`
          .toLowerCase()
          .includes(jobQuery.toLowerCase()),
      ),
    [jobs, jobQuery],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (productDivision === "All" || p.division === productDivision) &&
          `${p.title} ${p.location} ${p.description}`.toLowerCase().includes(productQuery.toLowerCase()),
      ),
    [products, productDivision, productQuery],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          orderFilter === "All" ||
          (orderFilter === "Pending payment" ? o.payment_status === "pending" : o.status === orderFilter),
      ),
    [orders, orderFilter],
  );

  const pendingPayments = useMemo(() => orders.filter((o) => o.payment_status === "pending"), [orders]);
  const cancelRequests = useMemo(
    () => orders.filter((o) => o.cancel_requested_at && !["Cancelled", "Completed"].includes(o.status)),
    [orders],
  );
  const lowStockProducts = useMemo(
    () => products.filter((p) => p.stock_quantity <= 0 && p.status === "available"),
    [products],
  );

  const attentionCount =
    (overview?.cancelRequests || 0) +
    (overview?.unreadInquiries || 0) +
    (overview?.newApplications || 0) +
    (overview?.pendingAppointments || 0);

  const navItems: Array<{ id: AdminSection; label: string; icon: Parameters<typeof Icon>[0]["name"]; show: boolean; badge?: number }> = [
    { id: "overview", label: "Overview", icon: "grid", show: true },
    { id: "jobs", label: "Gulf Jobs", icon: "briefcase", show: canManageListings, badge: overview?.activeJobs },
    { id: "products", label: "Shop & Fleet", icon: "package", show: canManageListings, badge: overview?.availableProducts },
    { id: "orders", label: "Orders", icon: "orders", show: canManageOrders, badge: overview?.activeOrders },
    { id: "applications", label: "Applications", icon: "apps", show: canManageSupport, badge: overview?.newApplications },
    { id: "appointments", label: "Appointments", icon: "calendar", show: canManageSupport, badge: overview?.pendingAppointments },
    { id: "inquiries", label: "Inquiries", icon: "message", show: canManageSupport, badge: overview?.unreadInquiries },
    { id: "staff", label: isSuperAdmin ? "Staff & 2FA" : "My Security", icon: "shield", show: true },
    { id: "settings", label: "Rules & Audit", icon: "settings", show: true },
  ];

  const businessRules = (settings.business_rules || {}) as Record<string, number>;
  const activeSectionMeta = navItems.find((item) => item.id === section);

  const quickJumpEntries = useMemo(() => {
    const entries: Array<{ id: string; group: string; title: string; subtitle: string; run: () => void }> = [];

    for (const item of navItems.filter((n) => n.show)) {
      entries.push({
        id: `nav-${item.id}`,
        group: "Sections",
        title: item.label,
        subtitle: typeof item.badge === "number" ? `${item.badge} items` : "Jump to workspace tab",
        run: () => {
          setSection(item.id);
          setQuickJumpOpen(false);
        },
      });
    }

    if (canManageListings) {
      entries.push({
        id: "act-new-job",
        group: "Quick Actions",
        title: "+ Add Gulf job posting",
        subtitle: "Publish a new overseas placement role",
        run: () => {
          setSection("jobs");
          setEditingJob(null);
          setShowJobModal(true);
          setQuickJumpOpen(false);
        },
      });
      entries.push({
        id: "act-new-prod",
        group: "Quick Actions",
        title: "+ Add Shop product or fleet listing",
        subtitle: "Vehicles, Real Estate, or Sanitation package",
        run: () => {
          setSection("products");
          setShowProductForm(true);
          setQuickJumpOpen(false);
        },
      });
    }
    if (isSuperAdmin) {
      entries.push({
        id: "act-new-staff",
        group: "Quick Actions",
        title: "+ Add staff account",
        subtitle: "Provision a role-based admin team member",
        run: () => {
          setSection("staff");
          setShowStaffForm(true);
          setQuickJumpOpen(false);
        },
      });
    }

    for (const ord of orders.slice(0, 12)) {
      entries.push({
        id: `ord-${ord.id}`,
        group: "Orders",
        title: ord.order_number,
        subtitle: `${ord.status} · KES ${ord.total_amount.toLocaleString("en-KE")}`,
        run: () => {
          setSection("orders");
          setOrderFilter("All");
          setQuickJumpOpen(false);
        },
      });
    }

    for (const job of jobs.slice(0, 10)) {
      entries.push({
        id: `job-${job.id}`,
        group: "Gulf Jobs",
        title: job.title,
        subtitle: `${job.destination_country} · ${Math.max(0, job.openings_total - job.openings_filled)} slots left`,
        run: () => {
          setSection("jobs");
          setJobQuery(job.title);
          setQuickJumpOpen(false);
        },
      });
    }

    const q = quickJumpQuery.trim().toLowerCase();
    if (!q) return entries.slice(0, 14);
    return entries
      .filter((e) => `${e.title} ${e.subtitle} ${e.group}`.toLowerCase().includes(q))
      .slice(0, 14);
  }, [canManageListings, isSuperAdmin, jobs, navItems, orders, quickJumpQuery]);

  return (
    <main className="admin-shell">
      {mobileMenu && (
        <div
          className="admin-sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside className={`admin-sidebar${mobileMenu ? " open" : ""}`}>
        <div className="admin-sidebar-head">
          <Link className="admin-brand" href="/" aria-label="Youamy Enterprises home">
            <Image src="/yel-logo.jpg" alt="" width={48} height={36} />
            <span>
              <strong>YOUAMY</strong>
              <small>ENTERPRISES ADMIN</small>
            </span>
          </Link>
          <button
            type="button"
            className="admin-drawer-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close admin menu"
          >
            ×
          </button>
        </div>

        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems
            .filter((item) => item.show)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className={`admin-nav-item${section === item.id ? " active" : ""}`}
                onClick={() => {
                  setSection(item.id);
                  setMobileMenu(false);
                }}
              >
                <Icon name={item.icon} />
                <span>{item.label}</span>
                {typeof item.badge === "number" && item.badge > 0 && (
                  <span className="admin-count">{item.badge}</span>
                )}
              </button>
            ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <Link className="admin-nav-item" href="/">
            <Icon name="grid" /> <span>Public storefront</span>
          </Link>
          <button
            className="admin-nav-item"
            type="button"
            onClick={async () => {
              await fetch("/api/admin/auth/logout", { method: "POST" });
              window.location.assign("/admin/login");
            }}
          >
            <Icon name="logout" /> <span>Sign out</span>
          </button>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <button
              type="button"
              className="admin-mobile-toggle"
              onClick={() => setMobileMenu((o) => !o)}
              aria-label="Toggle admin menu"
            >
              ☰
            </button>
            <div style={{ minWidth: 0 }}>
              <p>{dateLabel} · <strong>{activeSectionMeta?.label || "Overview"}</strong></p>
              <h1>{greeting}, {user.name.split(" ")[0]}</h1>
            </div>
          </div>

          <div className="admin-topbar-tools">
            <button
              type="button"
              className="admin-quickjump-btn"
              onClick={() => { setQuickJumpQuery(""); setQuickJumpOpen(true); }}
              title="Quick jump to any tab, order, or action (Ctrl+K)"
            >
              <Icon name="search" />
              <span>Quick jump…</span>
              <kbd>⌘K</kbd>
            </button>
            {canManageListings && (
              <button
                type="button"
                className="admin-quick-create"
                onClick={() => {
                  setSection("jobs");
                  setEditingJob(null);
                  setShowJobModal(true);
                }}
              >
                <Icon name="plus" /> <span>New job</span>
              </button>
            )}
            <div className="admin-account">
              <button
                type="button"
                className="admin-notification"
                title="Items needing attention"
                onClick={() => setSection("overview")}
              >
                {attentionCount}
              </button>
              <div className="admin-avatar">
                {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <strong>{user.name}</strong>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content">
          {notice && (
            <button className="admin-notice" type="button" onClick={() => setNotice("")}>
              {notice} <span aria-hidden="true">×</span>
            </button>
          )}
          {error && <p className="journey-error" style={{ marginBottom: 14 }} role="alert">{error}</p>}

          {section === "overview" && (loadingOverview ? <AdminOverviewSkeleton /> : (
            <>
              <section className="admin-stats" aria-label="Executive metrics">
                <article onClick={() => canManageOrders && setSection("orders")} style={{ cursor: "pointer" }}>
                  <span className="admin-stat-icon stat-green"><Icon name="orders" /></span>
                  <div>
                    <strong>KES {(overview?.revenueKes || 0).toLocaleString("en-KE")}</strong>
                    <span>Confirmed Revenue ({overview?.paidOrders || 0} paid)</span>
                  </div>
                </article>
                <article onClick={() => canManageListings && setSection("jobs")} style={{ cursor: "pointer" }}>
                  <span className="admin-stat-icon stat-red"><Icon name="briefcase" /></span>
                  <div>
                    <strong>{overview?.remainingJobSlots || 0}</strong>
                    <span>Open Gulf Slots ({overview?.activeJobs || 0} roles)</span>
                  </div>
                </article>
                <article onClick={() => canManageSupport && setSection("applications")} style={{ cursor: "pointer" }}>
                  <span className="admin-stat-icon stat-gold"><Icon name="apps" /></span>
                  <div>
                    <strong>{overview?.newApplications || 0}</strong>
                    <span>New Applications ({overview?.totalApplications || 0} total)</span>
                  </div>
                </article>
                <article onClick={() => canManageSupport && setSection("appointments")} style={{ cursor: "pointer" }}>
                  <span className="admin-stat-icon stat-blue"><Icon name="calendar" /></span>
                  <div>
                    <strong>{(overview?.pendingAppointments || 0) + (overview?.unreadInquiries || 0)}</strong>
                    <span>Pending Bookings &amp; Enquiries</span>
                  </div>
                </article>
              </section>

              <div className="admin-overview-grid">
                <section className="admin-listings" style={{ marginTop: 0 }}>
                  <div className="admin-listings-head">
                    <div><p>Action queue</p><h2>Requires attention</h2></div>
                  </div>
                  <div className="admin-attention-list">
                    {pendingPayments.map((o) => (
                      <div key={o.id} className="admin-attention-row">
                        <div>
                          <strong>Pending payment: {o.order_number}</strong>
                          <span>KES {o.total_amount.toLocaleString("en-KE")} awaiting confirmation</span>
                        </div>
                        <button type="button" className="admin-edit-product" onClick={() => setSection("orders")}>Review</button>
                      </div>
                    ))}
                    {cancelRequests.map((o) => (
                      <div key={o.id} className="admin-attention-row">
                        <div>
                          <strong>Cancellation requested: {o.order_number}</strong>
                          <span>KES {o.total_amount.toLocaleString("en-KE")}</span>
                        </div>
                        <button type="button" className="admin-edit-product" onClick={() => setSection("orders")}>Handle</button>
                      </div>
                    ))}
                    {(overview?.unreadInquiries || 0) > 0 && (
                      <div className="admin-attention-row">
                        <div>
                          <strong>{overview?.unreadInquiries} unread customer enquiries</strong>
                          <span>Website &amp; direct division requests waiting</span>
                        </div>
                        <button type="button" className="admin-edit-product" onClick={() => setSection("inquiries")}>Open</button>
                      </div>
                    )}
                    {lowStockProducts.map((p) => (
                      <div key={p.id} className="admin-attention-row">
                        <div>
                          <strong>Out of stock: {p.title}</strong>
                          <span>Stock quantity: {p.stock_quantity}</span>
                        </div>
                        <button type="button" className="admin-edit-product" onClick={() => setSection("products")}>Restock</button>
                      </div>
                    ))}
                    {pendingPayments.length === 0 && cancelRequests.length === 0 && (overview?.unreadInquiries || 0) === 0 && lowStockProducts.length === 0 && (
                      <div className="admin-empty">All queues clear. Great job!</div>
                    )}
                  </div>
                </section>

                <section className="admin-listings" style={{ marginTop: 0 }}>
                  <div className="admin-listings-head">
                    <div><p>Audit trail</p><h2>Recent team activity</h2></div>
                  </div>
                  <div className="admin-activity-feed">
                    {(overview?.recentActivity || []).slice(0, 8).map((ev) => (
                      <div key={ev.id} className="admin-activity-item">
                        <strong>{ev.actor_name}</strong> <span>{ev.details}</span>
                        <small>{new Date(ev.created_at).toLocaleString("en-KE")}</small>
                      </div>
                    ))}
                    {(!overview || overview.recentActivity.length === 0) && (
                      <div className="admin-empty">No recent activity logged yet.</div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ))}

          {section === "jobs" && canManageListings && (
            <section className="admin-listings" style={{ marginTop: 0 }}>
              <div className="admin-listings-head">
                <div><p>Gulf recruitment</p><h2>Manage job postings</h2></div>
                <button
                  type="button"
                  className="admin-add-button"
                  onClick={() => { setEditingJob(null); setShowJobModal(true); }}
                >
                  <Icon name="plus" /> Add job posting
                </button>
              </div>
              <div className="admin-tools">
                <span style={{ fontSize: 12, color: "#667287", fontWeight: 700 }}>{filteredJobs.length} job listings</span>
                <label className="admin-search">
                  <Icon name="search" />
                  <input value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder="Search jobs or country" />
                </label>
              </div>
              <div className="admin-table-wrap">
                {loadingJobs ? (
                  <AdminTableSkeleton rows={5} cols={6} />
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr><th>Role &amp; Location</th><th>Category</th><th>Salary</th><th>Slots left</th><th>Applicants</th><th>Status</th><th></th></tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const remaining = Math.max(0, job.openings_total - job.openings_filled);
                        return (
                          <tr key={job.id}>
                            <td>
                              <strong>{job.title}</strong>
                              <span>{job.destination_country} · {job.destination_city} · Deadline: {job.deadline}</span>
                            </td>
                            <td><span className="admin-division">{job.role_category}</span></td>
                            <td>{job.compensation_display}</td>
                            <td><strong>{remaining}</strong> / {job.openings_total}</td>
                            <td>{job.applications_count}</td>
                            <td><span className={`admin-status ${job.status === "Published" ? "published" : ""}`}><span /> {job.status}</span></td>
                            <td>
                              <button type="button" className="admin-edit-product" onClick={() => { setEditingJob(job); setShowJobModal(true); }}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {section === "products" && canManageListings && (
            <section className="admin-listings" style={{ marginTop: 0 }}>
              <div className="admin-listings-head">
                <div><p>Vehicles, Real Estate &amp; Sanitation Packages</p><h2>Shop &amp; fleet inventory</h2></div>
                <button type="button" className="admin-add-button" onClick={() => setShowProductForm(true)}>
                  <Icon name="plus" /> Add product / listing
                </button>
              </div>
              <div className="admin-tools">
                <div className="admin-tabs" role="tablist">
                  {["All", "Vehicles", "Real Estate", "Sanitation", "Other"].map((d) => (
                    <button key={d} className={productDivision === d ? "active" : ""} onClick={() => setProductDivision(d)}>{d}</button>
                  ))}
                </div>
                <label className="admin-search">
                  <Icon name="search" />
                  <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search inventory" />
                </label>
              </div>
              <div className="admin-table-wrap">
                {loadingProducts ? (
                  <AdminTableSkeleton rows={5} cols={6} />
                ) : (
                  <>
                    <table className="admin-table">
                      <thead>
                        <tr><th>Product</th><th>Division</th><th>Price (KES)</th><th>Stock</th><th>Booking Mode</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((product) => (
                          <tr key={product.id}>
                            <td>
                              <strong>{product.title}</strong>
                              <span>{product.location || "Kenya"} · {product.listing_kind}</span>
                            </td>
                            <td><span className="admin-division">{product.division}</span></td>
                            <td><strong>KES {product.amount_kes.toLocaleString("en-KE")}</strong><span>{product.price_unit}</span></td>
                            <td>{product.stock_quantity}</td>
                            <td>{product.booking_kind}</td>
                            <td>{product.purchasable && product.status === "available" ? "Live in shop" : product.status}</td>
                            <td>
                              <button type="button" className="admin-edit-product" onClick={() => setEditingProduct(product)}>Edit</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredProducts.length === 0 && <div className="admin-empty">No products match your filter.</div>}
                  </>
                )}
              </div>
            </section>
          )}

          {section === "orders" && canManageOrders && (
            <section className="admin-listings admin-orders" style={{ marginTop: 0 }}>
              <div className="admin-listings-head">
                <div><p>Client purchases &amp; bookings</p><h2>Orders &amp; payments</h2></div>
                <div className="admin-tabs">
                  {["All", "Pending payment", "Placed", "Confirmed", "In progress", "Completed", "Cancelled"].map((s) => (
                    <button key={s} className={orderFilter === s ? "active" : ""} onClick={() => setOrderFilter(s)}>{s}</button>
                  ))}
                </div>
              </div>
              <div className="admin-table-wrap">
                {loadingOrders ? (
                  <AdminTableSkeleton rows={5} cols={6} />
                ) : (
                  <>
                    <table className="admin-table">
                      <thead>
                        <tr><th>Order</th><th>Client</th><th>Items</th><th>Payment</th><th>Total</th><th>Status / Action</th></tr>
                      </thead>
                      <tbody>
                        {filteredOrders.map((order) => {
                          const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
                          return (
                            <tr key={order.id}>
                              <td>
                                <strong>{order.order_number}</strong>
                                <span>{new Date(order.created_at).toLocaleDateString("en-KE")}</span>
                                {order.cancel_requested_at && <span style={{ color: "#c81e27", fontWeight: 700 }}>Cancel requested</span>}
                              </td>
                              <td>
                                <strong>{profile?.full_name || "Client"}</strong>
                                <span>{profile?.phone || "—"}</span>
                              </td>
                              <td>
                                {(order.items || []).map((it, idx) => (
                                  <div key={idx}>{it.title} × {it.quantity}</div>
                                ))}
                              </td>
                              <td>
                                <span className={`order-payment ${order.payment_status}`}>{order.payment_status}</span>
                                {order.payment_status === "pending" && ["super_admin", "orders_admin"].includes(user.role) && (
                                  <div style={{ marginTop: 6 }}>
                                    <button type="button" className="admin-edit-product" onClick={() => void confirmOrderPayment(order)}>
                                      Verify paid
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td><strong>KES {order.total_amount.toLocaleString("en-KE")}</strong></td>
                              <td>
                                {["super_admin", "orders_admin"].includes(user.role) ? (
                                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <select
                                      className="admin-order-status"
                                      aria-label={`Update status for ${order.order_number}`}
                                      value={order.status}
                                      onChange={(event) => void updateOrderStatus(order, event.target.value)}
                                    >
                                      <option value={order.status} disabled>{order.status}</option>
                                      {(nextOrderStatuses[order.status] || []).map((status) => (
                                        <option key={status}>{status}</option>
                                      ))}
                                    </select>
                                    {order.payment_status === "paid" && (
                                      <a className="admin-edit-product" href={`/api/shop/orders/${order.id}/receipt`} style={{ display: "inline-flex", alignItems: "center" }}>
                                        PDF
                                      </a>
                                    )}
                                  </div>
                                ) : order.status}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredOrders.length === 0 && <div className="admin-empty">No orders match this view.</div>}
                  </>
                )}
              </div>
            </section>
          )}

          {section === "applications" && canManageSupport && (
            <AdminJobApplications onChanged={() => { refreshOverview(); refreshJobs(); }} />
          )}

          {section === "appointments" && canManageSupport && (
            <AdminAppointments onChanged={refreshOverview} />
          )}

          {section === "inquiries" && canManageSupport && (
            <AdminInquiries onChanged={refreshOverview} />
          )}

          {section === "staff" && (
            <div style={{ display: "grid", gap: 22 }}>
              <section className="admin-listings" style={{ marginTop: 0 }}>
                <div className="admin-listings-head">
                  <div><p>Personal account protection</p><h2>Change password</h2></div>
                </div>
                <form className="admin-form" onSubmit={changePassword}>
                  <label>
                    Current password
                    <input name="currentPassword" type="password" autoComplete="current-password" required />
                  </label>
                  <label>
                    New password
                    <input name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
                  </label>
                  <label>
                    Confirm new password
                    <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
                  </label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={passwordSaving}>
                      {passwordSaving ? "Updating…" : "Update password"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="admin-listings" style={{ marginTop: 0 }}>
                <div className="admin-listings-head">
                  <div><p>Personal account protection</p><h2>Two-factor authentication (TOTP)</h2></div>
                  <span className="admin-inquiry-count">{totpEnabled ? "2FA Active" : "2FA Optional"}</span>
                </div>
                <div style={{ padding: 22, display: "grid", gap: 14 }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#526179" }}>
                    Protect your staff workspace with a 6-digit authenticator app code (Google Authenticator, Authy, 1Password).
                  </p>
                  {totpEnabled ? (
                    <div>
                      <button type="button" className="journey-cancel-request" onClick={() => void disableTotp()}>
                        Disable 2FA on my account
                      </button>
                    </div>
                  ) : totpSecret ? (
                    <form onSubmit={enableTotp} style={{ display: "grid", gap: 12, maxWidth: 420 }}>
                      <div className="totp-setup">
                        <strong>Add this secret key to your authenticator app:</strong>
                        <code>{totpSecret}</code>
                      </div>
                      <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700 }}>
                        Enter 6-digit code to activate
                        <input
                          value={totpCode}
                          onChange={(e) => setTotpCode(e.target.value)}
                          maxLength={6}
                          required
                          style={{ height: 42, border: "1px solid #d5deeb", borderRadius: 6, padding: "0 12px" }}
                        />
                      </label>
                      <button type="submit" className="admin-add-button" style={{ width: "fit-content" }}>
                        Verify &amp; enable 2FA
                      </button>
                    </form>
                  ) : (
                    <div>
                      <button type="button" className="admin-add-button" onClick={() => void setupTotp()}>
                        Set up TOTP 2FA
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {isSuperAdmin && (
                <section className="admin-listings" style={{ marginTop: 0 }}>
                  <div className="admin-listings-head">
                    <div><p>Super admin</p><h2>Staff accounts &amp; permissions</h2></div>
                    <button type="button" className="admin-add-button" onClick={() => setShowStaffForm(true)}>
                      <Icon name="plus" /> Add staff account
                    </button>
                  </div>
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr><th>Name</th><th>Email</th><th>Role</th><th>2FA</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {staff.map((m) => (
                          <tr key={m.id}>
                            <td><strong>{m.name}</strong></td>
                            <td>{m.email}</td>
                            <td><span className="admin-division">{m.role.replaceAll("_", " ")}</span></td>
                            <td>{m.totp_enabled ? "Enabled" : "Off"}</td>
                            <td>{m.active ? "Active" : "Disabled"}</td>
                            <td>
                              <button type="button" className="admin-edit-product" onClick={() => void toggleStaffActive(m)}>
                                {m.active ? "Deactivate" : "Reactivate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}

          {section === "settings" && (
            <div style={{ display: "grid", gap: 22 }}>
              <section className="admin-listings" style={{ marginTop: 0 }}>
                <div className="admin-listings-head">
                  <div><p>Platform pricing &amp; safeguards</p><h2>Business logic rules</h2></div>
                </div>
                <form className="admin-form" onSubmit={saveBusinessRules}>
                  <label>Septic cleaning base (KES)<input name="septic_kes" type="number" defaultValue={businessRules.sanitation_septic_kes ?? 12000} /></label>
                  <label>Garbage collection base (KES)<input name="garbage_kes" type="number" defaultValue={businessRules.sanitation_garbage_kes ?? 3500} /></label>
                  <label>Skip bin base (KES)<input name="skipbin_kes" type="number" defaultValue={businessRules.sanitation_skipbin_kes ?? 18000} /></label>
                  <label>Commercial cleaning base (KES)<input name="commercial_kes" type="number" defaultValue={businessRules.sanitation_commercial_kes ?? 15000} /></label>
                  <label>Max bookings per time slot<input name="max_per_slot" type="number" defaultValue={businessRules.maxAppointmentsPerSlot ?? 3} /></label>
                  <label>Cancellation window (hrs)<input name="cancel_hours" type="number" defaultValue={businessRules.cancellationWindowHours ?? 24} /></label>
                  {["super_admin", "content_editor"].includes(user.role) && (
                    <div className="admin-form-actions">
                      <button type="submit">Save business rules</button>
                    </div>
                  )}
                </form>
              </section>

              <section className="admin-listings" style={{ marginTop: 0 }}>
                <div className="admin-listings-head">
                  <div><p>System compliance</p><h2>Complete audit log</h2></div>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th><th>Timestamp</th></tr>
                    </thead>
                    <tbody>
                      {activityLog.map((row) => (
                        <tr key={row.id}>
                          <td><strong>{row.actor_name}</strong></td>
                          <td><span className="admin-division">{row.action}</span></td>
                          <td>{row.entity_type}</td>
                          <td>{row.details}</td>
                          <td>{new Date(row.created_at).toLocaleString("en-KE")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>

      {showJobModal && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => { setShowJobModal(false); setEditingJob(null); }}>
          <div className="admin-modal admin-staff-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div><p>Gulf recruitment</p><h2>{editingJob ? "Edit job posting" : "New Gulf job posting"}</h2></div>
              <button type="button" onClick={() => { setShowJobModal(false); setEditingJob(null); }} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={submitJob}>
              <label>Job title<input name="title" defaultValue={editingJob?.title || ""} required /></label>
              <label>Category<input name="role_category" defaultValue={editingJob?.role_category || "Logistics"} required /></label>
              <label>Country<input name="destination_country" defaultValue={editingJob?.destination_country || "Saudi Arabia"} required /></label>
              <label>City<input name="destination_city" defaultValue={editingJob?.destination_city || "Riyadh"} required /></label>
              <label>Total openings<input name="openings_total" type="number" min="1" defaultValue={editingJob?.openings_total ?? 10} required /></label>
              <label>Salary / compensation<input name="compensation_display" defaultValue={editingJob?.compensation_display || ""} placeholder="e.g. SAR 2,800 / month" required /></label>
              <label>Deadline (YYYY-MM-DD)<input name="deadline" type="date" defaultValue={editingJob?.deadline || new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)} required /></label>
              <label>Status
                <select name="status" defaultValue={editingJob?.status || "Published"}>
                  <option value="Published">Published</option>
                  <option value="Draft">Draft</option>
                  <option value="Closed">Closed</option>
                  <option value="Archived">Archived</option>
                </select>
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Requirements
                <input name="requirements" defaultValue={editingJob?.requirements || ""} required />
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Benefits
                <input name="benefits" defaultValue={editingJob?.benefits || "Accommodation, medical cover and return ticket."} />
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => { setShowJobModal(false); setEditingJob(null); }}>Cancel</button>
                <button type="submit">{editingJob ? "Save changes" : "Publish job"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showProductForm && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setShowProductForm(false)}>
          <div className="admin-modal admin-staff-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div><p>Storefront &amp; fleet</p><h2>Add shop product / listing</h2></div>
              <button type="button" onClick={() => setShowProductForm(false)} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={addShopProduct}>
              <label>Product / listing title<input name="title" required /></label>
              <label>Division
                <select name="division" defaultValue="Vehicles">
                  <option>Vehicles</option>
                  <option>Real Estate</option>
                  <option>Sanitation</option>
                  <option>Other</option>
                </select>
              </label>
              <label>Listing kind
                <select name="listing_kind" defaultValue="vehicle_hire">
                  <option value="vehicle_sale">Vehicle sale</option>
                  <option value="vehicle_hire">Vehicle hire</option>
                  <option value="property_sale">Property sale</option>
                  <option value="property_rent">Property rent</option>
                  <option value="short_stay">Short stay / Airbnb</option>
                  <option value="sanitation_package">Sanitation package</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label>Location<input name="location" placeholder="e.g. Nyali, Mombasa" /></label>
              <label>Price (KES)<input name="amount_kes" type="number" min="1" step="1" required /></label>
              <label>Price unit
                <select name="price_unit" defaultValue="total">
                  <option value="total">Total price</option>
                  <option value="per_day">Per day (car hire)</option>
                  <option value="per_night">Per night (stay)</option>
                  <option value="per_month">Per month</option>
                  <option value="per_trip">Per trip</option>
                </select>
              </label>
              <label>Stock qty<input name="stock_quantity" type="number" min="0" defaultValue={1} /></label>
              <label>Booking mode
                <select name="booking_kind" defaultValue="none">
                  <option value="none">Direct purchase (no dates)</option>
                  <option value="car">Car pickup &amp; return</option>
                  <option value="short_stay">Short-stay check-in &amp; out</option>
                  <option value="sanitation">Sanitation dispatch</option>
                </select>
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Description
                <input name="description" />
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Photo URLs (one per line — local paths e.g. {localImagePresets[0]})
                <textarea name="image_urls" rows={2} defaultValue={localImagePresets[0]} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "1 / -1" }}>
                <input type="checkbox" name="purchasable" defaultChecked style={{ width: 18, height: 18 }} />
                <span>Available for online cart &amp; M-Pesa/Card checkout</span>
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => setShowProductForm(false)}>Cancel</button>
                <button type="submit">Publish product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingProduct && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setEditingProduct(null)}>
          <div className="admin-modal admin-staff-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div><p>Update listing</p><h2>Edit product</h2></div>
              <button type="button" onClick={() => setEditingProduct(null)} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={saveShopProduct}>
              <label>Product / listing title<input name="title" defaultValue={editingProduct.title} required /></label>
              <label>Division
                <select name="division" defaultValue={editingProduct.division}>
                  <option>Vehicles</option>
                  <option>Real Estate</option>
                  <option>Sanitation</option>
                  <option>Other</option>
                </select>
              </label>
              <label>Listing kind
                <select name="listing_kind" defaultValue={editingProduct.listing_kind || "general"}>
                  <option value="vehicle_sale">Vehicle sale</option>
                  <option value="vehicle_hire">Vehicle hire</option>
                  <option value="property_sale">Property sale</option>
                  <option value="property_rent">Property rent</option>
                  <option value="short_stay">Short stay / Airbnb</option>
                  <option value="sanitation_package">Sanitation package</option>
                  <option value="general">General</option>
                </select>
              </label>
              <label>Location<input name="location" defaultValue={editingProduct.location} /></label>
              <label>Price (KES)<input name="amount_kes" type="number" min="1" step="1" defaultValue={editingProduct.amount_kes} required /></label>
              <label>Price unit
                <select name="price_unit" defaultValue={editingProduct.price_unit || "total"}>
                  <option value="total">Total price</option>
                  <option value="per_day">Per day (car hire)</option>
                  <option value="per_night">Per night (stay)</option>
                  <option value="per_month">Per month</option>
                  <option value="per_trip">Per trip</option>
                </select>
              </label>
              <label>Stock qty<input name="stock_quantity" type="number" min="0" defaultValue={editingProduct.stock_quantity} /></label>
              <label>Booking mode
                <select name="booking_kind" defaultValue={editingProduct.booking_kind}>
                  <option value="none">Direct purchase (no dates)</option>
                  <option value="car">Car pickup &amp; return</option>
                  <option value="short_stay">Short-stay check-in &amp; out</option>
                  <option value="sanitation">Sanitation dispatch</option>
                </select>
              </label>
              <label>Status
                <select name="status" defaultValue={editingProduct.status}>
                  <option value="available">Available</option>
                  <option value="draft">Draft</option>
                  <option value="reserved">Reserved</option>
                  <option value="booked">Booked</option>
                  <option value="sold">Sold</option>
                  <option value="unavailable">Unavailable</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" name="purchasable" defaultChecked={editingProduct.purchasable} style={{ width: 18, height: 18 }} />
                <span>Purchasable in shop</span>
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Description
                <input name="description" defaultValue={editingProduct.description} />
              </label>
              <label className="admin-field-wide" style={{ gridColumn: "1 / -1" }}>
                Photo URLs (one per line)
                <textarea name="image_urls" rows={2} defaultValue={(editingProduct.image_urls || []).join("\n")} />
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => setEditingProduct(null)}>Cancel</button>
                <button type="submit">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStaffForm && isSuperAdmin && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setShowStaffForm(false)}>
          <div className="admin-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div><p>Super admin</p><h2>Add staff account</h2></div>
              <button type="button" onClick={() => setShowStaffForm(false)} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={addStaff}>
              <label>Name<input name="name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>Password (min 12 chars)<input name="password" type="password" minLength={12} required /></label>
              <label>Role
                <select name="role" defaultValue="listings_admin">
                  <option value="super_admin">Super admin</option>
                  <option value="listings_admin">Listings admin</option>
                  <option value="orders_admin">Orders admin</option>
                  <option value="support_agent">Support agent</option>
                  <option value="content_editor">Content editor</option>
                </select>
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => setShowStaffForm(false)}>Cancel</button>
                <button type="submit">Create staff account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {quickJumpOpen && (
        <div
          className="admin-modal-backdrop admin-quickjump-backdrop"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setQuickJumpOpen(false); }}
        >
          <div className="admin-quickjump-modal" role="dialog" aria-modal="true" aria-label="Admin Quick Jump">
            <div className="admin-quickjump-input-row">
              <Icon name="search" />
              <input
                autoFocus
                value={quickJumpQuery}
                onChange={(e) => setQuickJumpQuery(e.target.value)}
                placeholder="Jump to tab, search order YEL-ORD-, job, or run quick action…"
              />
              <button type="button" onClick={() => setQuickJumpOpen(false)} aria-label="Close quick jump">Esc</button>
            </div>
            <div className="admin-quickjump-list">
              {quickJumpEntries.length === 0 ? (
                <div className="admin-empty">No matching admin sections or items.</div>
              ) : (
                quickJumpEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className="admin-quickjump-row"
                    onClick={entry.run}
                  >
                    <div>
                      <span className="admin-quickjump-group">{entry.group}</span>
                      <strong>{entry.title}</strong>
                    </div>
                    <small>{entry.subtitle}</small>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <nav className="admin-mobile-bottom-nav" aria-label="Mobile quick navigation">
        <button type="button" className={section === "overview" ? "active" : ""} onClick={() => setSection("overview")}>
          <Icon name="grid" /><span>Home</span>
        </button>
        {canManageListings && (
          <button type="button" className={section === "jobs" ? "active" : ""} onClick={() => setSection("jobs")}>
            <Icon name="briefcase" /><span>Jobs</span>
          </button>
        )}
        {canManageOrders && (
          <button type="button" className={section === "orders" ? "active" : ""} onClick={() => setSection("orders")}>
            <Icon name="orders" /><span>Orders</span>
          </button>
        )}
        {canManageSupport && (
          <button type="button" className={section === "applications" ? "active" : ""} onClick={() => setSection("applications")}>
            <Icon name="apps" /><span>Apps</span>
          </button>
        )}
        <button type="button" onClick={() => setMobileMenu(true)}>
          <Icon name="settings" /><span>Menu</span>
        </button>
      </nav>
    </main>
  );
}
