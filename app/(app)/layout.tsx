import { Logo } from "@/components/ui/Logo";
import { NavLink } from "@/components/ui/nav-link";
import { strings } from "@/app/strings";
import { UserMenu } from "@/features/auth";
import { requireUserProfileForLayout } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, displayName, avatarUrl } = await requireUserProfileForLayout();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-stretch gap-4 px-4 sm:gap-6 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo width={34} height={34} />
            <div className="hidden flex-col leading-tight md:flex">
              <span className="text-sm font-semibold whitespace-nowrap">
                {strings.brand.schoolName}
              </span>
              <span className="text-xs text-muted-foreground">
                {strings.brand.portalName}
              </span>
            </div>
          </div>
          <nav className="flex items-stretch">
            <NavLink href="/students">{strings.nav.tracking}</NavLink>
            <NavLink href="/imports">{strings.nav.imports}</NavLink>
            <NavLink href="/transactions">{strings.nav.transactions}</NavLink>
            <NavLink href="/discounts">{strings.nav.discounts}</NavLink>
            <NavLink href="/calendar">{strings.nav.calendar}</NavLink>
          </nav>
          <div className="ml-auto flex items-center">
            <UserMenu
              email={user.email}
              role={user.role}
              displayName={displayName}
              avatarUrl={avatarUrl}
            />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
