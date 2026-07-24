"use client";

import { useCallback, useImperativeHandle, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { AllocationFormValues } from "../schemas";
import { classifyProposal, confidentProposal, proposalToLines } from "../triage";
import type {
  ProposalListItemWire,
  ProposalListResponseWire,
} from "../types";
import { strings } from "../strings";

import { CollapsedProposalRow } from "./CollapsedProposalRow";

async function parseErrorBody(res: Response): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `HTTP ${res.status}`);
}

// Confident rows are cheap (one line), but thousands of DOM nodes still add up.
// Render the confident tier in chunks; selection and bulk confirm operate on the
// whole tier regardless of what's rendered.
const CONFIDENT_CHUNK = 50;
const BULK_CONCURRENCY = 6;

type Tab = "all" | "attention" | "confident";
type Tally = { confirmed: number; deleted: number; skipped: number };
const ZERO_TALLY: Tally = { confirmed: 0, deleted: 0, skipped: 0 };

function isConfident(p: ProposalListItemWire): boolean {
  return (
    classifyProposal(p.result, p.transactionPreview.amount) === "confident"
  );
}

function confidentIdSet(resp: ProposalListResponseWire): Set<number> {
  return new Set(
    resp.proposals.filter(isConfident).map((p) => p.bankTransactionId),
  );
}

// Run async workers over items with bounded concurrency.
async function runPool<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor++]!;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
}

export type ReviewTableHandle = {
  refresh: () => Promise<void>;
};

type Props = {
  initialData: ProposalListResponseWire;
  handleRef?: React.Ref<ReviewTableHandle>;
};

export function ReviewTable({ initialData, handleRef }: Props) {
  const [data, setData] = useState<ProposalListResponseWire>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tally, setTally] = useState<Tally>(ZERO_TALLY);
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(() =>
    confidentIdSet(initialData),
  );
  const [tab, setTab] = useState<Tab>("all");
  const [visibleConfident, setVisibleConfident] = useState(CONFIDENT_CHUNK);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkResult, setBulkResult] = useState<{ ok: number; failed: number } | null>(
    null,
  );

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
      setSelected(confidentIdSet(json));
      setTally(ZERO_TALLY);
      setVisibleConfident(CONFIDENT_CHUNK);
      setBulkResult(null);
    } catch {
      setError(strings.review.error);
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(handleRef, () => ({ refresh: load }), [load]);

  // Remove one row locally (keeps the other rows' in-progress edits alive) and
  // drop it from the selection.
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
    setSelected((prev) => {
      if (!prev.has(bankTransactionId)) return prev;
      const next = new Set(prev);
      next.delete(bankTransactionId);
      return next;
    });
  }, []);

  const onConfirm = useCallback(
    async (values: AllocationFormValues) => {
      const res = await fetch(`/api/imports/${values.bankTransactionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) throw await parseErrorBody(res);
      removeRow(values.bankTransactionId);
      setTally((t) => ({ ...t, confirmed: t.confirmed + 1 }));
    },
    [removeRow],
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
    },
    [removeRow],
  );

  const onSkip = useCallback((bankTransactionId: number) => {
    setSkipped((s) => new Set(s).add(bankTransactionId));
    setSelected((prev) => {
      if (!prev.has(bankTransactionId)) return prev;
      const next = new Set(prev);
      next.delete(bankTransactionId);
      return next;
    });
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
  }, []);

  const studentById = useMemo(
    () => new Map(data.context.students.map((s) => [s.id, s])),
    [data.context.students],
  );
  const chargeById = useMemo(
    () => new Map(data.context.openCharges.map((c) => [c.id, c])),
    [data.context.openCharges],
  );

  const remaining = useMemo(
    () => data.proposals.filter((p) => !skipped.has(p.bankTransactionId)),
    [data.proposals, skipped],
  );
  const attention = useMemo(
    () => remaining.filter((p) => !isConfident(p)),
    [remaining],
  );
  const confident = useMemo(
    () => remaining.filter((p) => isConfident(p)),
    [remaining],
  );
  const selectedPresent = confident.filter((p) =>
    selected.has(p.bankTransactionId),
  );

  const runBulk = async () => {
    const jobs = selectedPresent
      .map((p) => {
        const cp = confidentProposal(p.result, p.transactionPreview.amount);
        return cp ? proposalToLines(p.bankTransactionId, cp) : null;
      })
      .filter((v): v is AllocationFormValues => v !== null);
    if (jobs.length === 0) return;

    setBulkRunning(true);
    setBulkResult(null);
    setBulkProgress({ done: 0, total: jobs.length });
    let ok = 0;
    let failed = 0;
    await runPool(jobs, BULK_CONCURRENCY, async (values) => {
      try {
        await onConfirm(values);
        ok += 1;
      } catch {
        failed += 1;
      }
      setBulkProgress((p) => ({ ...p, done: p.done + 1 }));
    });
    setBulkRunning(false);
    setBulkResult({ ok, failed });
  };

  const tallyParts = [
    tally.confirmed > 0 ? strings.review.confirmedTally(tally.confirmed) : null,
    tally.deleted > 0 ? strings.review.deletedTally(tally.deleted) : null,
    tally.skipped > 0 ? strings.review.skippedTally(tally.skipped) : null,
  ].filter(Boolean);

  const renderRow = (p: ProposalListItemWire) => (
    <CollapsedProposalRow
      key={p.bankTransactionId}
      item={p}
      tier={isConfident(p) ? "confident" : "attention"}
      context={data.context}
      studentById={studentById}
      chargeById={chargeById}
      selected={selected.has(p.bankTransactionId)}
      onToggleSelect={() =>
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(p.bankTransactionId)) next.delete(p.bankTransactionId);
          else next.add(p.bankTransactionId);
          return next;
        })
      }
      onConfirm={onConfirm}
      onDelete={() => onDelete(p.bankTransactionId)}
      onSkip={() => onSkip(p.bankTransactionId)}
    />
  );

  const showAttention = tab === "all" || tab === "attention";
  const showConfident = tab === "all" || tab === "confident";
  const visibleConfidentRows = confident.slice(0, visibleConfident);
  const hiddenConfident = confident.length - visibleConfidentRows.length;

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
            disabled={loading || bulkRunning}
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

        {remaining.length === 0 ? (
          <div className="text-sm text-muted-foreground">{strings.review.empty}</div>
        ) : (
          <>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList>
                <TabsTrigger value="all">{strings.triage.tabs.all}</TabsTrigger>
                <TabsTrigger value="attention">
                  {strings.triage.tabs.attention}
                  <Badge variant="warning">{attention.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="confident">
                  {strings.triage.tabs.confident}
                  <Badge variant="success">{confident.length}</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Needs attention — top. */}
            {showAttention ? (
              <section className="flex flex-col gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {strings.triage.attentionHeading}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {attention.length === 0
                      ? strings.triage.noAttention
                      : strings.triage.attentionHint}
                  </span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {attention.map((p) => (
                    <li key={p.bankTransactionId}>{renderRow(p)}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Confident — collapsed, pre-selected, bulk confirm. */}
            {showConfident ? (
              <section className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {strings.triage.confidentHeading}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {confident.length === 0
                        ? strings.triage.noConfident
                        : strings.triage.confidentHint}
                    </span>
                  </div>
                  {confident.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {strings.triage.selectedCount(selectedPresent.length)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={bulkRunning}
                        onClick={() =>
                          setSelected(
                            new Set(confident.map((p) => p.bankTransactionId)),
                          )
                        }
                      >
                        {strings.triage.selectAll}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={bulkRunning}
                        onClick={() => setSelected(new Set())}
                      >
                        {strings.triage.clear}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={bulkRunning || selectedPresent.length === 0}
                        onClick={() => void runBulk()}
                      >
                        {bulkRunning
                          ? strings.triage.confirmingProgress(
                              bulkProgress.done,
                              bulkProgress.total,
                            )
                          : strings.triage.confirmSelected(selectedPresent.length)}
                      </Button>
                    </div>
                  ) : null}
                </div>

                {bulkResult ? (
                  <div
                    className={
                      bulkResult.failed > 0
                        ? "text-sm text-destructive"
                        : "text-sm text-success"
                    }
                  >
                    {strings.triage.bulkDone(bulkResult.ok, bulkResult.failed)}
                  </div>
                ) : null}

                <ul className="flex flex-col gap-1.5">
                  {visibleConfidentRows.map((p) => (
                    <li key={p.bankTransactionId}>{renderRow(p)}</li>
                  ))}
                </ul>
                {hiddenConfident > 0 ? (
                  <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
                    <span>
                      {strings.review.showingCount(
                        visibleConfidentRows.length,
                        confident.length,
                      )}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setVisibleConfident((c) => c + CONFIDENT_CHUNK)
                      }
                    >
                      {strings.review.showMore(
                        Math.min(CONFIDENT_CHUNK, hiddenConfident),
                      )}
                    </Button>
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
