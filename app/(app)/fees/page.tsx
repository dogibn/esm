import type { Metadata } from "next";

import { FeesView, listFeeRates, strings } from "@/features/fees";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.page.title };

// Readable by every accountant — what the school charges is context they need.
// Publishing a new rate is admin-only, and the route enforces it.
export default async function FeesPage() {
  const user = await requireUserForLayout();
  const overview = await listFeeRates();
  return <FeesView overview={overview} canEdit={user.role === "admin"} />;
}
