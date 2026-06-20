import { Logo } from "@/components/ui/Logo";
import { NavLink } from "@/components/ui/nav-link";
import { strings } from "@/app/strings";
import { SignOutButton } from "@/features/auth";
import { requireUserForLayout } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserForLayout();

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3">
          <Logo width={32} height={32} />
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/students">{strings.nav.tracking}</NavLink>
            <NavLink href="/imports">{strings.nav.imports}</NavLink>
            <NavLink href="/transactions">{strings.nav.transactions}</NavLink>
            <span className="ml-3">
              <SignOutButton>{strings.auth.signOut}</SignOutButton>
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1">{children}</main>
    </div>
  );
}
