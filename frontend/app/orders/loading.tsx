import { SiteHeader, SiteFooter } from "@/components/site-shell";
import { OrderSkeletonList } from "@/components/skeletons";

export default function OrdersLoading() {
  return (
    <>
      <SiteHeader />
      <main className="journey-page journey-wide">
        <header className="journey-page-head">
          <div>
            <p className="section-kicker">Your account</p>
            <h1>My Orders</h1>
          </div>
        </header>
        <OrderSkeletonList count={4} />
      </main>
      <SiteFooter />
    </>
  );
}
