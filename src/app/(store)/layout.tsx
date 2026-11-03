import { Suspense } from "react";
import { CartDrawer } from "@/components/store/cart-drawer";
import { StoreFooter } from "@/components/store/footer";
import { StoreNav } from "@/components/store/nav";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* The nav reads usePathname(), which is request data on dynamic routes */}
      <Suspense>
        <StoreNav />
      </Suspense>
      <main className="flex-1">{children}</main>
      <StoreFooter />
      <CartDrawer />
    </>
  );
}
