"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import AdminInquiries from "@/components/admin-inquiries";

type Division = "Jobs" | "Vehicles" | "Real Estate" | "Sanitation";

type Listing = {
  id: number;
  title: string;
  division: Division;
  detail: string;
  status: "Published" | "Draft";
  updated: string;
  archived?: boolean;
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
};
type ShopProduct = {
  id: string;
  title: string;
  division: string;
  description: string;
  image_urls: string[];
  amount_kes: number;
  status: string;
  purchasable: boolean;
  booking_kind: "none" | "car" | "short_stay";
};

const nextOrderStatuses: Record<string, string[]> = {
  "Pending payment": ["Cancelled"],
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["In progress", "Cancelled"],
  "In progress": ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
};

const initialListings: Listing[] = [
  { id: 1, title: "Heavy Duty Trailer Drivers (GCC License)", division: "Jobs", detail: "Saudi Arabia · Riyadh · 25 slots", status: "Published", updated: "Today" },
  { id: 2, title: "2019 Toyota Land Cruiser Prado TX-L", division: "Vehicles", detail: "Available · Ksh 6,850,000", status: "Published", updated: "Yesterday" },
  { id: 3, title: "Modern 4-Bedroom Villa with DSQ", division: "Real Estate", detail: "Nyali, Mombasa · Ksh 32,000,000", status: "Published", updated: "3 days ago" },
  { id: 4, title: "Exhauster septic cleaning", division: "Sanitation", detail: "Mombasa / Nairobi Corridor", status: "Published", updated: "1 week ago" },
];

function Icon({ name }: { name: "grid" | "briefcase" | "car" | "home" | "droplet" | "message" | "settings" | "plus" | "search" | "logout" }) {
  const paths = {
    grid: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
    briefcase: "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 8h18v11H3V8Zm8 4h2",
    car: "m5 12 2-5h10l2 5M3 12h18v7H3v-7Zm3 7v2m12-2v2M6 16h.01M18 16h.01",
    home: "M3 11l9-8 9 8M5 10v11h14V10M9 21v-6h6v6",
    droplet: "M12 2s7 8 7 13a7 7 0 1 1-14 0c0-5 7-13 7-13Z",
    message: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
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
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [activeDivision, setActiveDivision] = useState<"All" | Division>("All");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staff, setStaff] = useState<Array<{ id: number; name: string; email: string; role: string; active: number }>>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [orderError, setOrderError] = useState("");
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);

  useEffect(() => {
    if (!["super_admin", "listings_admin"].includes(user.role)) return;
    fetch("/api/admin/shop/products")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setProducts(result.products);
      })
      .catch((reason: unknown) => setNotice(reason instanceof Error ? reason.message : "Could not load shop products."));
  }, [user.role]);

  useEffect(() => {
    fetch("/api/admin/listings")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.listings) {
          setListings(data.listings.map((listing: {
            id: number;
            title: string;
            division: Division;
            detail: string;
            status: "Published" | "Draft";
            updated_at: string;
            archived: number;
          }) => ({
            id: listing.id,
            title: listing.title,
            division: listing.division,
            detail: listing.detail,
            status: listing.status,
            updated: listing.archived ? "Archived" : listing.updated_at,
            archived: Boolean(listing.archived),
          })));
        }
      })
      .catch(() => setNotice("Could not load listings"));
  }, []);

  useEffect(() => {
    if (!["super_admin", "orders_admin", "support_agent"].includes(user.role)) return;
    fetch("/api/admin/shop/orders")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setOrders(result.orders);
      })
      .catch((reason: unknown) => setOrderError(reason instanceof Error ? reason.message : "Could not load orders."));
  }, [user.role]);

  function addListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const listing: Listing = {
      id: Date.now(),
      title: String(data.get("title") || "").trim(),
      division: String(data.get("division")) as Division,
      detail: String(data.get("detail") || "").trim(),
      status: String(data.get("status")) as Listing["status"],
      updated: "Just now",
    };
    fetch("/api/admin/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: listing.title,
        division: listing.division,
        detail: listing.detail,
        status: listing.status,
      }),
    }).then(async (response) => {
      if (!response.ok) {
        const result = await response.json();
        setNotice(result.error || "Could not add listing");
        return;
      }
      setListings((current) => [listing, ...current]);
      setShowForm(false);
      setNotice("Listing added");
      event.currentTarget.reset();
    });
  }

  function toggleStatus(id: number) {
    const listing = listings.find((item) => item.id === id);
    if (!listing) return;
    const status = listing.status === "Published" ? "Draft" : "Published";
    fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((response) => {
      if (!response.ok) {
        setNotice("You do not have permission to change listing status.");
        return;
      }
      setListings((current) =>
        current.map((item) => item.id === id ? { ...item, status, updated: "Just now" } : item),
      );
      setNotice(`Listing marked ${status.toLowerCase()}`);
    });
  }

  function deleteListing(id: number) {
    if (!window.confirm("Archive this listing? It can be restored later.")) return;
    fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }).then((response) => {
      if (!response.ok) {
        setNotice("You do not have permission to archive listings.");
        return;
      }
      setListings((current) =>
        current.map((item) => item.id === id ? { ...item, archived: true, updated: "Archived" } : item),
      );
      setNotice("Listing moved to the archive");
    });
  }

  function restoreListing(id: number) {
    fetch(`/api/admin/listings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: false }),
    }).then((response) => {
      if (response.ok) {
        setListings((current) => current.map((item) => item.id === id ? { ...item, archived: false, updated: "Just now" } : item));
        setNotice("Listing restored");
      }
    });
  }

  function openStaff() {
    fetch("/api/admin/staff")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setStaff(data?.staff || []));
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setNotice(result.error || "Could not add staff member");
      return;
    }
    setShowStaffForm(false);
    setNotice("Staff member added");
    openStaff();
  }

  async function updateOrderStatus(order: ShopOrder, status: string) {
    const response = await fetch("/api/admin/shop/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id, status }),
    });
    const result = await response.json();
    if (!response.ok) {
      setOrderError(result.error || "Could not update order.");
      return;
    }
    setOrders((current) => current.map((item) => item.id === order.id ? { ...item, status, cancel_requested_at: status === "Cancelled" ? null : item.cancel_requested_at } : item));
    setNotice(`Order ${order.order_number} updated`);
  }

  async function addShopProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/shop/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        division: data.get("division"),
        description: data.get("description"),
        amount_kes: Number(data.get("amount_kes")),
        image_urls: String(data.get("image_urls") || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        booking_kind: data.get("booking_kind"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Could not add product.");
      return;
    }
    const refresh = await fetch("/api/admin/shop/products");
    const refreshed = await refresh.json();
    if (refresh.ok) setProducts(refreshed.products);
    setShowProductForm(false);
    setNotice("Confirmed product is now available in the shop.");
  }

  async function saveShopProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/shop/products/${editingProduct.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: data.get("title"),
        division: data.get("division"),
        description: data.get("description"),
        amount_kes: Number(data.get("amount_kes")),
        image_urls: String(data.get("image_urls") || "").split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        booking_kind: data.get("booking_kind"),
        status: data.get("status"),
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      setNotice(result.error || "Could not update product.");
      return;
    }
    const refresh = await fetch("/api/admin/shop/products");
    const refreshed = await refresh.json();
    if (refresh.ok) setProducts(refreshed.products);
    setEditingProduct(null);
    setNotice("Product updated");
  }

  const filteredListings = listings.filter((listing) => {
    const matchesDivision = activeDivision === "All" || listing.division === activeDivision;
    const matchesQuery = `${listing.title} ${listing.detail}`.toLowerCase().includes(query.toLowerCase());
    return matchesDivision && matchesQuery;
  });

  const publishedCount = listings.filter((listing) => listing.status === "Published").length;
  const draftCount = listings.length - publishedCount;
  const activeDivisionCount = new Set(
    listings.filter((listing) => !listing.archived && listing.status === "Published").map((listing) => listing.division),
  ).size;

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/" aria-label="Youamy Enterprises home">
          <Image src="/yel-logo.jpg" alt="" width={48} height={36} />
          <span>
            <strong>YOUAMY</strong>
            <small>ENTERPRISES LIMITED</small>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="Admin navigation">
          <Link className="admin-nav-item active" href="/admin">
            <Icon name="grid" /> Dashboard
          </Link>
          <a className="admin-nav-item" href="#jobs"><Icon name="briefcase" /> Jobs</a>
          <a className="admin-nav-item" href="#vehicles"><Icon name="car" /> Vehicles</a>
          <a className="admin-nav-item" href="#real-estate"><Icon name="home" /> Real Estate</a>
          <a className="admin-nav-item" href="#sanitation"><Icon name="droplet" /> Sanitation</a>
          {["super_admin", "support_agent"].includes(user.role) && (
            <a className="admin-nav-item" href="#enquiries"><Icon name="message" /> Enquiries</a>
          )}
          {user.role === "super_admin" && (
            <button className="admin-nav-item" onClick={() => { openStaff(); setShowStaffForm(true); }} type="button">
              <Icon name="settings" /> Staff
            </button>
          )}
          {["super_admin", "orders_admin", "support_agent"].includes(user.role) && (
            <a className="admin-nav-item" href="#admin-orders"><Icon name="message" /> Orders</a>
          )}
        </nav>

        <div className="admin-sidebar-bottom">
          <a className="admin-nav-item" href="#settings"><Icon name="settings" /> Settings</a>
          <button
            className="admin-nav-item"
            type="button"
            onClick={async () => {
              await fetch("/api/admin/auth/logout", { method: "POST" });
              window.location.assign("/admin/login");
            }}
          >
            <Icon name="logout" /> Sign out
          </button>
          <Link className="admin-nav-item" href="/">View public site</Link>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <p>Sunday, 22 November</p>
            <h1>Good morning, YEL team</h1>
          </div>
          <div className="admin-account">
            <button className="admin-notification" aria-label="Notifications">3</button>
            <div className="admin-avatar">{user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role.replaceAll("_", " ")}</span>
            </div>
          </div>
        </header>

        <div className="admin-content">
          {notice && (
            <button className="admin-notice" onClick={() => setNotice("")}>
              {notice}
              <span aria-hidden="true">×</span>
            </button>
          )}

          {["super_admin", "listings_admin"].includes(user.role) && (
          <>
          <section className="admin-stats" aria-label="Listing overview">
            <article>
              <span className="admin-stat-icon stat-red"><Icon name="briefcase" /></span>
              <div><strong>{listings.length}</strong><span>Total listings</span></div>
            </article>
            <article>
              <span className="admin-stat-icon stat-green"><Icon name="grid" /></span>
              <div><strong>{publishedCount}</strong><span>Published</span></div>
            </article>
            <article>
              <span className="admin-stat-icon stat-gold"><Icon name="settings" /></span>
              <div><strong>{draftCount}</strong><span>Draft listings</span></div>
            </article>
            <article>
              <span className="admin-stat-icon stat-blue"><Icon name="message" /></span>
              <div><strong>{activeDivisionCount}</strong><span>Active divisions</span></div>
            </article>
          </section>

          <section className="admin-listings">
            <div className="admin-listings-head">
              <div>
                <p>Catalogue</p>
                <h2>Manage listings</h2>
              </div>
              <button className="admin-add-button" onClick={() => setShowForm(true)}>
                <Icon name="plus" /> Add listing
              </button>
            </div>

            <div className="admin-tools">
              <div className="admin-tabs" role="tablist" aria-label="Listing divisions">
                {(["All", "Jobs", "Vehicles", "Real Estate", "Sanitation"] as const).map((division) => (
                  <button
                    key={division}
                    className={activeDivision === division ? "active" : ""}
                    onClick={() => setActiveDivision(division)}
                    role="tab"
                    aria-selected={activeDivision === division}
                  >
                    {division}
                  </button>
                ))}
              </div>
              <label className="admin-search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search listings"
                  aria-label="Search listings"
                />
              </label>
            </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Listing</th>
                    <th>Division</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map((listing) => (
                    <tr key={listing.id}>
                      <td>
                        <strong>{listing.title}</strong>
                        <span>{listing.detail}</span>
                      </td>
                      <td><span className={`admin-division division-${listing.division.toLowerCase().replace(" ", "-")}`}>{listing.division}</span></td>
                      <td>
                        <button
                          className={`admin-status ${listing.status.toLowerCase()}`}
                          onClick={() => toggleStatus(listing.id)}
                          title="Change status"
                        >
                          <span /> {listing.status}
                        </button>
                      </td>
                      <td>{listing.updated}</td>
                      <td>
                        {listing.archived ? (
                          <button className="admin-delete" onClick={() => restoreListing(listing.id)} title="Restore listing" aria-label={`Restore ${listing.title}`}>
                            ↺
                          </button>
                        ) : (
                          <button className="admin-delete" onClick={() => deleteListing(listing.id)} aria-label={`Archive ${listing.title}`}>
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredListings.length === 0 && (
                <div className="admin-empty">No listings match this view.</div>
              )}
            </div>
          </section>
          </>
          )}

          {["super_admin", "listings_admin"].includes(user.role) && (
            <section className="admin-listings shop-admin-list" id="admin-shop-products">
              <div className="admin-listings-head">
                <div><p>Confirmed inventory</p><h2>Shop products</h2></div>
                <button className="admin-add-button" onClick={() => setShowProductForm(true)}><Icon name="plus" /> Add product</button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Product</th><th>Division</th><th>Price</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
                  <tbody>{products.map((product) => (
                    <tr key={product.id}>
                      <td><strong>{product.title}</strong></td>
                      <td>{product.division}</td>
                      <td>KES {product.amount_kes.toLocaleString("en-KE")}</td>
                      <td>{product.purchasable && product.status === "available" ? "Available to order" : "Not for sale"}</td>
                      <td><button className="admin-edit-product" onClick={() => setEditingProduct(product)}>Edit</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                {products.length === 0 && <div className="admin-empty">Add a listing with a confirmed price to let clients order it.</div>}
              </div>
            </section>
          )}

          {["super_admin", "orders_admin", "support_agent"].includes(user.role) && (
            <section className="admin-listings admin-orders" id="admin-orders">
              <div className="admin-listings-head"><div><p>Client purchases</p><h2>Orders</h2></div></div>
              {orderError && <p className="journey-error">{orderError}</p>}
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead><tr><th>Order</th><th>Client</th><th>Payment</th><th>Total</th><th>Status</th></tr></thead>
                  <tbody>{orders.map((order) => {
                    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
                    const contact = profile?.phone || "—";
                    return (
                      <tr key={order.id}>
                        <td><strong>{order.order_number}</strong>{order.cancel_requested_at && <span>Cancellation requested</span>}</td>
                        <td><strong>{profile?.full_name || "Client"}</strong><span>{contact}</span></td>
                        <td>{order.payment_status}</td>
                        <td>KES {order.total_amount.toLocaleString("en-KE")}</td>
                        <td>
                          {user.role === "super_admin" || user.role === "orders_admin" ? (
                            <select
                              className="admin-order-status"
                              aria-label={`Update status for ${order.order_number}`}
                              value={order.status}
                              onChange={(event) => updateOrderStatus(order, event.target.value)}
                            >
                              <option value={order.status} disabled>{order.status}</option>
                              {(nextOrderStatuses[order.status] || []).map((status) => <option key={status}>{status}</option>)}
                            </select>
                          ) : order.status}
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
                {orders.length === 0 && !orderError && <div className="admin-empty">No client orders yet.</div>}
              </div>
            </section>
          )}

          {["super_admin", "support_agent"].includes(user.role) && <AdminInquiries />}
        </div>
      </section>

      {showForm && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setShowForm(false)}>
          <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="add-listing-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <p>New catalogue entry</p>
                <h2 id="add-listing-title">Add listing</h2>
              </div>
              <button onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={addListing}>
              <label>Listing title<input name="title" required /></label>
              <label>Division
                <select name="division" defaultValue="Jobs">
                  <option>Jobs</option>
                  <option>Vehicles</option>
                  <option>Real Estate</option>
                  <option>Sanitation</option>
                </select>
              </label>
              <label className="admin-field-wide">Detail<input name="detail" placeholder="Location, price, role or service" required /></label>
              <label>Status
                <select name="status" defaultValue="Draft">
                  <option>Draft</option>
                  <option>Published</option>
                </select>
              </label>
              <div className="admin-form-actions">
                <button type="button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit">Add listing</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showStaffForm && (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setShowStaffForm(false)}>
          <div className="admin-modal admin-staff-modal" role="dialog" aria-modal="true" aria-labelledby="staff-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <p>Super admin</p>
                <h2 id="staff-title">Staff accounts</h2>
              </div>
              <button onClick={() => setShowStaffForm(false)} aria-label="Close">×</button>
            </div>
            <form className="admin-form" onSubmit={addStaff}>
              <label>Name<input name="name" required /></label>
              <label>Email<input name="email" type="email" required /></label>
              <label>Password<input name="password" type="password" minLength={12} required /></label>
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
                <button type="submit">Create account</button>
              </div>
            </form>
            {staff.length > 0 && (
              <div className="admin-staff-list">
                {staff.map((member) => (
                  <div key={member.id}>
                    <strong>{member.name}</strong>
                    <span>{member.email}</span>
                    <span>{member.role.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}
            {showProductForm && (
              <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setShowProductForm(false)}>
                <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="admin-modal-head">
                    <div><p>Only confirmed items can be purchased</p><h2 id="product-title">Add shop product</h2></div>
                    <button onClick={() => setShowProductForm(false)} aria-label="Close">×</button>
                  </div>
                  <form className="admin-form" onSubmit={addShopProduct}>
                    <label>Product name<input name="title" required /></label>
                    <label>Division<select name="division" defaultValue="Vehicles"><option>Vehicles</option><option>Real Estate</option><option>Sanitation</option><option>Other</option></select></label>
                    <label>Price (KES)<input name="amount_kes" type="number" min="1" step="1" required /></label>
                    <label>Booking details<select name="booking_kind" defaultValue="none"><option value="none">No booking dates</option><option value="car">Car pickup and return</option><option value="short_stay">Check-in and check-out</option></select></label>
                    <label className="admin-field-wide">Description<input name="description" /></label>
                    <label className="admin-field-wide">Photo URLs (one per line)<textarea name="image_urls" rows={3} /></label>
                    <div className="admin-form-actions"><button type="button" onClick={() => setShowProductForm(false)}>Cancel</button><button type="submit">Publish product</button></div>
                  </form>
                </div>
              </div>
            )}
            {editingProduct && (
              <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setEditingProduct(null)}>
                <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="edit-product-title" onMouseDown={(event) => event.stopPropagation()}>
                  <div className="admin-modal-head">
                    <div><p>Update confirmed product information</p><h2 id="edit-product-title">Edit product</h2></div>
                    <button onClick={() => setEditingProduct(null)} aria-label="Close">×</button>
                  </div>
                  <form className="admin-form" onSubmit={saveShopProduct}>
                    <label>Product name<input name="title" defaultValue={editingProduct.title} required /></label>
                    <label>Division<input name="division" defaultValue={editingProduct.division} required /></label>
                    <label>Price (KES)<input name="amount_kes" type="number" min="1" defaultValue={editingProduct.amount_kes} required /></label>
                    <label>Availability<select name="status" defaultValue={editingProduct.status}><option value="available">Available</option><option value="booked">Booked</option><option value="sold">Sold</option><option value="unavailable">Unavailable</option></select></label>
                    <label>Booking details<select name="booking_kind" defaultValue={editingProduct.booking_kind}><option value="none">No booking dates</option><option value="car">Car pickup and return</option><option value="short_stay">Check-in and check-out</option></select></label>
                    <label className="admin-field-wide">Description<input name="description" defaultValue={editingProduct.description} /></label>
                    <label className="admin-field-wide">Photo URLs (one per line)<textarea name="image_urls" rows={3} defaultValue={editingProduct.image_urls.join("\n")} /></label>
                    <div className="admin-form-actions"><button type="button" onClick={() => setEditingProduct(null)}>Cancel</button><button type="submit">Save changes</button></div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
