"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { AllocationFormValues } from "../schemas";
import { attentionReason, type ProposalTier } from "../triage";
import { strings } from "../strings";
import type {
  MatchProposalWire,
  ProposalListItemWire,
  ReviewContext,
  ReviewOpenCharge,
  ReviewStudent,
} from "../types";

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

// The single-student proposal to summarise, or null (splits / no match).
function topProposal(item: ProposalListItemWire): MatchProposalWire | null {
  const r = item.result;
  switch (r.kind) {
    case "matched":
    case "low_confidence":
      return r.proposals[0] ?? null;
    case "matched_multi":
    case "unmatched":
      return null;
  }
}

function studentLabel(
  studentId: number,
  studentById: Map<number, ReviewStudent>,
): string {
  const s = studentById.get(studentId);
  if (!s) return `#${studentId}`;
  const name = `${s.lastName} ${s.firstName}`.trim();
  return s.gradeName ? `${name} · ${s.gradeName}` : name;
}

function chargeLabel(
  p: MatchProposalWire,
  chargeById: Map<number, ReviewOpenCharge>,
): string | null {
  const names = p.allocations
    .map((a) => chargeById.get(a.chargeId)?.feeName)
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(" + ") : null;
}

type Props = {
  item: ProposalListItemWire;
  tier: ProposalTier;
  context: ReviewContext;
  studentById: Map<number, ReviewStudent>;
  chargeById: Map<number, ReviewOpenCharge>;
  selected: boolean;
  onToggleSelect: () => void;
  onConfirm: (values: AllocationFormValues) => Promise<void>;
  onDelete: () => Promise<void>;
  onSkip: () => void;
};

export function CollapsedProposalRow({
  item,
  tier,
  context,
  studentById,
  chargeById,
  selected,
  onToggleSelect,
  onConfirm,
  onDelete,
  onSkip,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const t = item.transactionPreview;
  const isConfident = tier === "confident";
  const top = topProposal(item);

  // Proposed target text: student · charge for single-student matches,
  // a split label for multi, or a "no match" hint.
  let targetText: string;
  if (item.result.kind === "matched_multi") {
    targetText = strings.triage.splitStudents(item.result.proposal.proposals.length);
  } else if (top) {
    const charge = chargeLabel(top, chargeById);
    const student = studentLabel(top.studentId, studentById);
    targetText = charge ? `${student} · ${charge}` : student;
  } else {
    targetText = strings.triage.noProposal;
  }

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete();
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        selected && isConfident && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      {/* Collapsed one-line summary */}
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
        {isConfident ? (
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={targetText}
          />
        ) : (
          <span className="w-4" aria-hidden />
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={expanded ? strings.triage.collapse : strings.triage.expand}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </Button>

        {/* Memo — the primary identifier. */}
        <span
          className="min-w-0 flex-1 truncate text-foreground"
          title={t.memo ?? ""}
        >
          {t.memo ?? (
            <span className="text-muted-foreground">{strings.triage.noMemo}</span>
          )}
        </span>

        {/* Proposed target. */}
        <span className="hidden min-w-0 max-w-[22rem] shrink-0 items-center gap-1 truncate text-muted-foreground sm:flex">
          <span aria-hidden>{strings.triage.proposedFor}</span>
          <span className="truncate text-foreground">{targetText}</span>
        </span>

        {/* Amount. */}
        <span className="shrink-0 tabular-nums font-medium">
          {fmtAmount(t.amount)}
        </span>

        {/* Status / reason. */}
        {isConfident ? (
          <Badge variant="success">{strings.triage.balanced}</Badge>
        ) : (
          <Badge variant="warning">
            {strings.triage.reason[attentionReason(item.result, t.amount)]}
          </Badge>
        )}

        {/* Quick skip for attention rows (no editing needed to defer). */}
        {!isConfident ? (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            {strings.form.skip}
          </Button>
        ) : null}
      </div>

      {/* Expanded editor + bank details */}
      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-border p-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {strings.triage.detailsLabel}:
              </span>{" "}
              {t.senderName ?? "—"}
            </span>
            {t.senderAccount ? (
              <span className="font-mono">{t.senderAccount}</span>
            ) : null}
            <span className="font-mono">{t.transactionId}</span>
            <span>{fmtDate(t.transactionAt)}</span>
          </div>
          <AllocationForm
            proposal={item}
            context={context}
            onConfirm={onConfirm}
            onDelete={() => setDeleteOpen(true)}
            onSkip={onSkip}
          />
        </div>
      ) : null}

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
