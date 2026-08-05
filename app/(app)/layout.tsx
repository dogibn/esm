import { cookies } from "next/headers";

import { AppSidebar, SIDEBAR_COOKIE, isCollapsedCookie } from "@/features/shell";
import { requireUserProfileForLayout } from "@/lib/auth";

/**
 * App shell: navigation on the left, page on the right. There is no header
 * bar — the sidebar carries the brand, the navigation, and the identity block,
 * which leaves each page's own <PageHeader> to own the title and that page's
 * primary action.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, displayName, avatarUrl } = await requireUserProfileForLayout();

  // Read on the server so the first paint is already the right width.
  const cookieStore = await cookies();
  const collapsed = isCollapsedCookie(cookieStore.get(SIDEBAR_COOKIE)?.value);

  return (
    <div className="flex min-h-svh bg-background text-foreground">
      <AppSidebar
        defaultCollapsed={collapsed}
        user={{
          email: user.email,
          role: user.role,
          displayName,
          avatarUrl,
        }}
      />
      {/* min-w-0 so a wide table scrolls inside the page instead of stretching
          the shell. */}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
