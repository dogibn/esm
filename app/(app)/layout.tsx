import { requireUserForLayout } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUserForLayout();
  return <>{children}</>;
}
