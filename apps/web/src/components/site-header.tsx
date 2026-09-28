import { auth } from "@/auth";
import { MarketingNav } from "@/components/landing/marketing-nav";

/**
 * Public header. Server component: reads the session and hands a plain
 * serialisable `user` to the client nav, which owns the scroll-aware
 * elevation and the mobile disclosure menu.
 */
export async function SiteHeader() {
  const session = await auth();
  const user = session?.user ?? null;

  return (
    <MarketingNav
      user={
        user
          ? { name: user.name ?? user.email ?? "Account", email: user.email ?? "" }
          : null
      }
    />
  );
}
