import type { Metadata } from "next";

import { ClassesView, classesQuerySchema, listClasses, strings } from "@/features/classes";
import { requireUserForLayout } from "@/lib/auth";

export const metadata: Metadata = { title: strings.page.title };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Readable by every accountant; the controls are admin-only, and the mutation
// routes enforce requireAdmin regardless.
export default async function ClassesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUserForLayout();
  const raw = await searchParams;
  const query = classesQuerySchema.parse({ year: raw.year });
  const overview = await listClasses(query);
  return <ClassesView overview={overview} canEdit={user.role === "admin"} />;
}
