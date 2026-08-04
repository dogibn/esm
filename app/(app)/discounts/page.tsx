import { DiscountsView, listDiscountTypes } from "@/features/discounts";
import { requireUserForLayout } from "@/lib/auth";

// Catalog is viewable by every accountant; only admins see the edit controls
// (and the mutation routes enforce requireAdmin regardless).
export default async function DiscountsPage() {
  const user = await requireUserForLayout();
  const types = await listDiscountTypes();
  return <DiscountsView types={types} canEdit={user.role === "admin"} />;
}
