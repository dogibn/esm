import type { Metadata } from "next";

import { FeesView, feesQuerySchema, listFeeRates, strings } from "@/features/fees";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.page.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Readable by every accountant — what the school charges is context they need.
// Publishing a new rate is admin-only, and the route enforces it.
export default async function FeesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUserForLayout();
  const raw = await searchParams;
  const query = feesQuerySchema.parse({ tab: raw.tab });
  const overview = await listFeeRates();
  return (
    <FeesView overview={overview} tab={query.tab} canEdit={user.role === "admin"} />
  );
}
