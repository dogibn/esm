import {
  ImportsView,
  listProposals,
  proposalListResponseToWire,
  strings,
} from "@/features/imports";
import { requireUserForLayout } from "@/lib/auth";

export default async function ImportsPage() {
  const user = await requireUserForLayout();
  const initialProposals = proposalListResponseToWire(await listProposals(user));

  return (
    <section className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">{strings.title}</h1>
      <ImportsView initialProposals={initialProposals} />
    </section>
  );
}
