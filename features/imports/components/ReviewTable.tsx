"use client";

import { useCallback, useImperativeHandle, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

import type { AllocationFormValues } from "../schemas";
import type {
  ProposalListItemWire,
  ProposalListResponseWire,
} from "../types";
import { strings } from "../strings";

import { AllocationForm } from "./AllocationForm";

const numberFormatter = new Intl.NumberFormat("en-US");
function fmtAmount(n: number): string {
  return numberFormatter.format(n);
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ulaanbaatar",
  }).format(new Date(iso));
}

async function parseErrorBody(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `HTTP ${res.status}`);
}

function kindBadgeVariant(
  kind: ProposalListItemWire["result"]["kind"],
): "success" | "warning" | "destructive" {
  switch (kind) {
    case "matched":
    case "matched_multi":
      return "success";
    case "low_confidence":
      return "warning";
    case "unmatched":
      return "destructive";
  }
}

export type ReviewTableHandle = {
  refresh: () => Promise<void>;
};

type Props = {
  /** Server-rendered first page of proposals (same shape the refetch returns). */
  initialData: ProposalListResponseWire;
  /** Optional imperative ref for parents to trigger a refetch. */
  handleRef?: React.Ref<ReviewTableHandle>;
};

type Tally = { confirmed: number; deleted: number; skipped: number };
const ZERO_TALLY: Tally = { confirmed: 0, deleted: 0, skipped: 0 };

// Each proposal row mounts a full allocation form; rendering hundreds at once
// makes the page unusably long and slow. Reveal incrementally instead.
const PAGE_SIZE = 20;

export function ReviewTable({ initialData, handleRef }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<ProposalListResponseWire>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Session-only tallies, reset on every (re)load. Skip is intentionally not
  // a write — a skipped row simply stays unmatched and reappears on reload.
  const [tally, setTally] = useState<Tally>(ZERO_TALLY);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/imports/proposals", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ProposalListResponseWire;
      setData(json);
      setSkipped(new Set());
      setTally(ZERO_TALLY);
      setVisibleCount(PAGE_SIZE);
    } catch {
      setError(strings.review.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(handleRef, () => ({ refresh: load }), [load]);

  // Remove one row locally instead of refetching: a refetch would remount
  // every AllocationForm and wipe the accountant's in-progress edits on the
  // other rows.
  const removeRow = useCallback((bankTransactionId: number) => {
    setData((prev) => ({
      ...prev,
      proposals: prev.proposals.filter(
        (p) => p.bankTransactionId !== bankTransactionId,
      ),
      meta: {
        ...prev.meta,
        totalUnmatched: Math.max(0, prev.meta.totalUnmatched - 1),
      },
    }));
  }, []);

  const onConfirm = useCallback(
    async (values: AllocationFormValues) => {
      const res = await fetch(
        `/api/imports/${values.bankTransactionId}/confirm`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(values),
        },
      );
      if (!res.ok) throw await parseErrorBody(res);
      removeRow(values.bankTransactionId);
      setTally((t) => ({ ...t, confirmed: t.confirmed + 1 }));
      toast({ message: strings.toasts.paymentRecorded, variant: "success" });
    },
    [removeRow, toast],
  );

  const onDelete = useCallback(
    async (bankTransactionId: number) => {
      const res = await fetch(`/api/imports/${bankTransactionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw await parseErrorBody(res);
      removeRow(bankTransactionId);
      setTally((t) => ({ ...t, deleted: t.deleted + 1 }));
      toast({ message: strings.toasts.transactionDiscarded, variant: "success" });
    },
    [removeRow, toast],
  );

  const onSkip = useCallback((bankTransactionId: number) => {
    setSkipped((s) => {
      const next = new Set(s);
      next.add(bankTransactionId);
      return next;
    });
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
  }, []);

  const remainingProposals = data.proposals.filter(
    (p) => !skipped.has(p.bankTransactionId),
  );
  const visibleProposals = remainingProposals.slice(0, visibleCount);
  const hiddenCount = remainingProposals.length - visibleProposals.length;

  const tallyParts = [
    tally.confirmed > 0 ? strings.review.confirmedTally(tally.confirmed) : null,
    tally.deleted > 0 ? strings.review.deletedTally(tally.deleted) : null,
    tally.skipped > 0 ? strings.review.skippedTally(tally.skipped) : null,
  ].filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.review.title}</CardTitle>
        <CardDescription>
          {strings.review.meta(
            data.meta.yearName,
            data.meta.termName,
            data.meta.totalUnmatched,
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? strings.review.loading : strings.review.refresh}
          </Button>
          {tallyParts.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {tallyParts.join(" · ")}
            </span>
          ) : null}
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
        </div>

        {visibleProposals.length === 0 ? (
          <div className="text-sm text-muted-foreground">{strings.review.empty}</div>
        ) : (
          <>
            <ul className="flex flex-col gap-3">
              {visibleProposals.map((p) => (
                <li key={p.bankTransactionId}>
                  <ProposalRow
                    proposal={p}
                    context={data.context}
                    onConfirm={onConfirm}
                    onDelete={() => onDelete(p.bankTransactionId)}
                    onSkip={() => onSkip(p.bankTransactionId)}
                  />
                </li>
              ))}
            </ul>
            {hiddenCount > 0 ? (
              <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                <span>
                  {strings.review.showingCount(
                    visibleProposals.length,
                    remainingProposals.length,
                  )}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                >
                  {strings.review.showMore(Math.min(PAGE_SIZE, hiddenCount))}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ProposalRow({
  proposal,
  context,
  onConfirm,
  onDelete,
  onSkip,
}: {
  proposal: ProposalListItemWire;
  context: ProposalListResponseWire["context"];
  onConfirm: (values: AllocationFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  onSkip: () => void;
}) {
  const t = proposal.transactionPreview;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
      // Row unmounts on success; no state cleanup needed.
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <div className="flex flex-col">
          <span className="font-mono text-xs text-muted-foreground">
            {t.transactionId}
          </span>
          <span className="flex items-center gap-2 font-medium">
            {t.senderName ?? "—"}
            {t.senderAccount ? (
              <span className="font-mono text-xs text-muted-foreground">
                {t.senderAccount}
              </span>
            ) : null}
            <Badge variant={kindBadgeVariant(proposal.result.kind)}>
              {strings.review.kind[proposal.result.kind]}
            </Badge>
          </span>
        </div>
        <div className="text-right text-sm">
          <div className="font-semibold tabular-nums">{fmtAmount(t.amount)} MNT</div>
          <div className="text-xs text-muted-foreground">{fmtDate(t.transactionAt)}</div>
        </div>
      </div>
      {t.memo ? (
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Memo:</span> {t.memo}
        </div>
      ) : null}
      <AllocationForm
        proposal={proposal}
        context={context}
        onConfirm={onConfirm}
        onDelete={() => setDeleteOpen(true)}
        onSkip={onSkip}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.form.deleteDialogTitle}</DialogTitle>
            <DialogDescription>{strings.form.deleteDialogBody}</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <span className="font-medium">{t.senderName ?? "—"}</span>
            {" · "}
            <span className="tabular-nums">{fmtAmount(t.amount)} MNT</span>
            {" · "}
            <span className="text-muted-foreground">{fmtDate(t.transactionAt)}</span>
          </div>
          {deleteError ? (
            <div className="text-sm text-destructive">{deleteError}</div>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" size="sm" />}>
              {strings.form.deleteDialogCancel}
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? strings.form.deletePending : strings.form.deleteDialogConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
