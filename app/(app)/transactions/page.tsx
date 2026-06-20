import {
  TransactionsView,
  listTransactions,
  strings,
  transactionListParamsSchema,
  transactionListResponseToWire,
} from "@/features/transactions";
import { requireUserForLayout } from "@/lib/auth";

export default async function TransactionsPage() {
  const user = await requireUserForLayout();
  const params = transactionListParamsSchema.parse({});
  const initialData = await listTransactions(user, params);

  return (
    <section className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{strings.title}</h1>
        <p className="text-sm text-muted-foreground">{strings.description}</p>
      </div>
      <TransactionsView initialData={transactionListResponseToWire(initialData)} />
    </section>
  );
}
