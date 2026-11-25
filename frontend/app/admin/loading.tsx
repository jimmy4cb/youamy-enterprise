import { AdminOverviewSkeleton } from "@/components/skeletons";

export default function AdminLoading() {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar" aria-hidden="true">
        <div style={{ padding: 12 }}>
          <div className="skeleton-shimmer" style={{ height: 36, borderRadius: 8 }} />
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer" style={{ height: 40, borderRadius: 8 }} />
          ))}
        </div>
      </aside>
      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <div className="skeleton-shimmer" style={{ width: 160, height: 12, borderRadius: 4 }} />
            <div className="skeleton-shimmer" style={{ width: 220, height: 28, borderRadius: 6, marginTop: 8 }} />
          </div>
        </header>
        <div className="admin-content">
          <AdminOverviewSkeleton />
        </div>
      </section>
    </main>
  );
}
