import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { CatalogSkeletonGrid, PanelSkeleton } from "@/components/skeletons";

export default function AppLoading() {
  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <PanelSkeleton lines={3} />
        <div style={{ marginTop: 28 }}>
          <CatalogSkeletonGrid count={3} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
