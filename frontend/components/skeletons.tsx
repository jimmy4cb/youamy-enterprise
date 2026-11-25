export function SkeletonBlock({
  width = "100%",
  height = 16,
  radius = 8,
  className = "",
}: {
  width?: string | number;
  height?: string | number;
  radius?: number;
  className?: string;
}) {
  return (
    <span
      className={`skeleton-shimmer ${className}`.trim()}
      style={{
        display: "block",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: `${radius}px`,
      }}
      aria-hidden="true"
    />
  );
}

export function CatalogSkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="shop-product-grid" aria-busy="true" aria-label="Loading listings">
      {Array.from({ length: count }).map((_, idx) => (
        <article className="shop-product skeleton-card" key={idx}>
          <SkeletonBlock height={210} radius={0} />
          <div className="shop-product-body">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <SkeletonBlock width="32%" height={14} radius={4} />
              <SkeletonBlock width="28%" height={14} radius={4} />
            </div>
            <SkeletonBlock width="84%" height={20} radius={6} />
            <SkeletonBlock width="100%" height={14} radius={4} />
            <SkeletonBlock width="72%" height={14} radius={4} />
            <SkeletonBlock width="45%" height={22} radius={6} />
            <SkeletonBlock width="100%" height={44} radius={8} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function JobSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="recruitment-job-list" aria-busy="true" aria-label="Loading job opportunities">
      {Array.from({ length: count }).map((_, idx) => (
        <article className="recruitment-job-card skeleton-card" key={idx}>
          <div className="recruitment-job-info" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <SkeletonBlock width={110} height={24} radius={999} />
              <SkeletonBlock width={90} height={24} radius={999} />
              <SkeletonBlock width={85} height={24} radius={999} />
            </div>
            <SkeletonBlock width="68%" height={24} radius={6} />
            <SkeletonBlock width="48%" height={16} radius={4} />
            <SkeletonBlock width="90%" height={14} radius={4} />
            <SkeletonBlock width="78%" height={14} radius={4} />
          </div>
          <div className="recruitment-job-action" style={{ display: "grid", gap: 8 }}>
            <SkeletonBlock width="100%" height={44} radius={8} />
            <SkeletonBlock width="80%" height={12} radius={4} />
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrderSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="orders-list" aria-busy="true" aria-label="Loading orders">
      {Array.from({ length: count }).map((_, idx) => (
        <div className="order-list-card skeleton-card" key={idx}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <SkeletonBlock width={160} height={16} radius={4} />
            <SkeletonBlock width={80} height={22} radius={999} />
          </div>
          <SkeletonBlock width="70%" height={15} radius={4} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <SkeletonBlock width={90} height={14} radius={4} />
            <SkeletonBlock width={110} height={18} radius={4} />
            <SkeletonBlock width={68} height={20} radius={999} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="skeleton-panel" aria-busy="true" aria-label="Loading content">
      <SkeletonBlock width="38%" height={14} radius={4} />
      <SkeletonBlock width="64%" height={28} radius={6} />
      {Array.from({ length: lines }).map((_, idx) => (
        <SkeletonBlock
          key={idx}
          width={idx === lines - 1 ? "55%" : "100%"}
          height={idx % 2 === 0 ? 44 : 18}
          radius={8}
        />
      ))}
    </div>
  );
}

export function AdminTableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="admin-skeleton-wrap" aria-busy="true" aria-label="Loading admin records">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="admin-skeleton-row"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, colIdx) => (
            <SkeletonBlock
              key={colIdx}
              width={colIdx === 0 ? "88%" : "68%"}
              height={colIdx === 0 ? 18 : 14}
              radius={6}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function AdminOverviewSkeleton() {
  return (
    <div style={{ display: "grid", gap: 22 }} aria-busy="true" aria-label="Loading executive dashboard">
      <section className="admin-stats">
        {Array.from({ length: 4 }).map((_, idx) => (
          <article key={idx} className="skeleton-card">
            <SkeletonBlock width={46} height={46} radius={10} />
            <div style={{ display: "grid", gap: 8, flex: 1 }}>
              <SkeletonBlock width="70%" height={22} radius={6} />
              <SkeletonBlock width="85%" height={13} radius={4} />
            </div>
          </article>
        ))}
      </section>
      <div className="admin-overview-grid">
        <section className="admin-listings" style={{ marginTop: 0, padding: 20 }}>
          <SkeletonBlock width="45%" height={22} radius={6} />
          <div style={{ marginTop: 16 }}>
            <AdminTableSkeleton rows={4} cols={2} />
          </div>
        </section>
        <section className="admin-listings" style={{ marginTop: 0, padding: 20 }}>
          <SkeletonBlock width="45%" height={22} radius={6} />
          <div style={{ marginTop: 16 }}>
            <AdminTableSkeleton rows={4} cols={2} />
          </div>
        </section>
      </div>
    </div>
  );
}
