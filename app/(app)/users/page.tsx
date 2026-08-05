import { notFound } from "next/navigation";

import { UsersView, listUsers } from "@/features/users";
import { requireUserForLayout } from "@/lib/auth";

// Admin-only, unlike the other Setup screens: an accountant gets a 404 rather
// than a read-only view. The sidebar hides the link for them too, so a
// non-admin only lands here by typing the URL — 404 is the honest answer.
// The routes under /api/users enforce requireAdmin independently.
export default async function UsersPage() {
  const user = await requireUserForLayout();
  if (user.role !== "admin") notFound();

  const users = await listUsers();
  return <UsersView users={users} currentUserId={user.id} />;
}
