"use client";

import { useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { NEW_CHARGE_PLACEHOLDER_ID } from "../matching";
import { memoWithoutSenderBlock } from "../memo";
import {
  blankLine,
  editCreatesCharge,
  editSum,
  isEditConfirmable,
  proposalLines,
  resultCandidates,
  resultFlags,
  resultSignals,
  rollupSignals,
  type ChargeLine,
  type RowEdit,
} from "../triage";
import { strings } from "../strings";
import type {
  MatchProposalWire,
  ProposalListItemWire,
  ReviewClass,
  ReviewOpenCharge,
  ReviewStudent,
} from "../types";

const ALL_CLASSES = "__all__";

/**
 * One column template, applied identically to every row, so the controls form
 * columns down the list instead of drifting with each memo's length. Every
 * track is a fixed width except the memo, which absorbs the slack — a track
 * sized to its content would be a different width on every row and defeat the
 * whole point.
 *
 * Reading order follows the work: what the bank sent (memo, amount) first, then
 * where it goes (class → student → charge → how much of the transfer). The
 * transaction amount is sized for eight digits and no more.
 *
 * The same template is used for a split's extra charge rows, so the second
 * charge sits directly under the first with its own class and student.
 *
 * The row is wider than a small screen; the list scrolls sideways rather than
 * squashing the columns (see MIN_ROW_WIDTH).
 */
const ROW_GRID =
  "grid grid-cols-[3rem_minmax(14rem,1fr)_5.5rem_5.5rem_9.5rem_11.5rem_7rem_10.5rem] items-start gap-x-2";
const MIN_ROW_WIDTH = "min-w-[70rem]";
/** First allocation column — where a split row's cells start. */
const ALLOCATION_COL_START = "col-start-4";

/**
 * Let a trigger grow to fit its label instead of clipping it. `h-auto!` is the
 * one place an important modifier is warranted: the primitive pins its height
 * through a `data-[size]` variant, which out-specifies any plain height class.
 */
const WRAPPING_TRIGGER =
  "h-auto! min-h-7 w-full items-start py-1 text-left whitespace-normal";
// The charge <Select> is keyed by charge id; the fee that doesn't exist yet
// needs a key of its own, and it must be the placeholder the server understands.
const NEW_CHARGE_VALUE = String(NEW_CHARGE_PLACEHOLDER_ID);
const numberFormatter = new Intl.NumberFormat("en-US");
const fmt = (n: number) => numberFormatter.format(n);
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

type Props = {
  item: ProposalListItemWire;
  allStudents: ReviewStudent[];
  studentById: Map<number, ReviewStudent>;
  openChargesByStudent: Map<number, ReviewOpenCharge[]>;
  classes: ReviewClass[];
  edit: RowEdit;
  onEditChange: (next: RowEdit) => void;
  /** Whether this row takes part in a bulk action (and so shows a checkbox). */
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onConfirm: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onSkip: () => void;
};

export function CollapsedProposalRow({
  item,
  allStudents,
  studentById,
  openChargesByStudent,
  classes,
  edit,
  onEditChange,
  selectable,
  selected,
  onToggleSelect,
  onConfirm,
  onDiscard,
  onSkip,
}: Props) {
  const t = item.transactionPreview;
  const txAmount = t.amount;
  const displayMemo = memoWithoutSenderBlock(t.memo);

  // Every allocation line names its own student, so a transfer shared by two
  // children and one shared by two of a child's fees are the same shape: line
  // one lives in the row proper, the rest are charge rows underneath it.
  const lines = edit.lines.length > 0 ? edit.lines : [blankLine(txAmount)];
  const splitMode = lines.length > 1;

  /**
   * Class narrows the student list; it is not part of the allocation, so it
   * lives here, per line. A line with no explicit choice follows its own
   * student's class — which is what makes a seeded sibling split come up with
   * each child already filtered to their own class.
   */
  const [classFilters, setClassFilters] = useState<Record<number, string | null>>(
    {},
  );
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const classFilterFor = (i: number): string | null =>
    i in classFilters
      ? classFilters[i] ?? null
      : studentById.get(lines[i]?.studentId ?? 0)?.gradeName ?? null;

  const studentsByClass = useMemo(() => {
    const m = new Map<string, ReviewStudent[]>();
    for (const s of allStudents) {
      if (!s.gradeName) continue;
      const arr = m.get(s.gradeName);
      if (arr) arr.push(s);
      else m.set(s.gradeName, [s]);
    }
    return m;
  }, [allStudents]);

  const studentsFor = (i: number): ReviewStudent[] => {
    const cls = classFilterFor(i);
    return cls === null ? allStudents : studentsByClass.get(cls) ?? [];
  };

  const chargeOptionsFor = (line: ChargeLine) => {
    const options = (openChargesByStudent.get(line.studentId) ?? []).map((c) => ({
      value: String(c.id),
      label: `${c.feeName} · ${fmt(c.outstandingBalance)}`,
    }));
    // The matcher's proposed fee stays on offer while its student does — "create
    // a bus charge" is a statement about *this* child.
    if (line.newCharge) {
      options.push({
        value: NEW_CHARGE_VALUE,
        label: strings.triage.controls.addFeeOption(
          line.newCharge.feeName,
          fmt(line.newCharge.amount),
        ),
      });
    }
    return options;
  };

  // Editing helpers — all funnel through onEditChange so ReviewTable stays the
  // single source of truth.
  const setLines = (next: ChargeLine[]) => {
    onEditChange({ lines: next });
    setRowError(null);
  };

  const setLineStudent = (i: number, s: ReviewStudent | null) => {
    // Switching students invalidates that line's charge — and any fee the
    // matcher proposed creating, which was about the student it picked.
    setLines(
      lines.map((l, idx) =>
        idx === i
          ? { studentId: s ? s.id : 0, chargeId: 0, amount: l.amount }
          : l,
      ),
    );
    setClassFilters((prev) => ({ ...prev, [i]: s?.gradeName ?? null }));
  };

  const setLineClass = (i: number, cls: string | null) => {
    setClassFilters((prev) => ({ ...prev, [i]: cls }));
    // If this line's student isn't in the new class, clear it so a stale
    // student can't stay attached to the wrong class.
    const line = lines[i];
    if (
      cls !== null &&
      line &&
      line.studentId > 0 &&
      studentById.get(line.studentId)?.gradeName !== cls
    ) {
      setLines(
        lines.map((l, idx) =>
          idx === i ? { studentId: 0, chargeId: 0, amount: l.amount } : l,
        ),
      );
    }
  };

  const setLineCharge = (i: number, chargeId: number) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, chargeId } : l)));

  const setLineAmount = (i: number, amount: number) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, amount } : l)));

  /**
   * A new charge row starts on the student above it — most splits pay two of
   * one child's fees — and claims whatever of the transfer is still unallocated.
   * Siblings are one combobox away.
   */
  const addLine = () => {
    const last = lines[lines.length - 1];
    setLines([
      ...lines,
      {
        studentId: last?.studentId ?? 0,
        chargeId: 0,
        amount: Math.max(0, txAmount - editSum({ lines })),
      },
    ]);
  };

  const removeLine = (i: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, idx) => idx !== i));
    // Class filters are keyed by position, so the ones below the removed line
    // shift up with it.
    setClassFilters((prev) => {
      const next: Record<number, string | null> = {};
      for (const [key, value] of Object.entries(prev)) {
        const idx = Number(key);
        if (idx < i) next[idx] = value;
        else if (idx > i) next[idx - 1] = value;
      }
      return next;
    });
  };

  const toggleSplit = () => {
    if (!splitMode) {
      addLine();
      return;
    }
    // Collapse back to the first line, taking the whole transfer back.
    setLines([{ ...lines[0]!, amount: txAmount }]);
    setClassFilters((prev) =>
      0 in prev ? ({ 0: prev[0] ?? null } as Record<number, string | null>) : {},
    );
  };

  const applyCandidate = (p: MatchProposalWire) => {
    setLines(proposalLines(p, txAmount));
    setClassFilters({});
  };

  const runConfirm = async () => {
    setConfirming(true);
    setRowError(null);
    try {
      await onConfirm();
    } catch (e) {
      setRowError((e as Error).message);
      setConfirming(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDiscard();
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
  };

  const allocated = editSum({ lines });
  const confirmable = isEditConfirmable({ lines }, txAmount);
  const creatingCharge = editCreatesCharge({ lines });
  const signals = rollupSignals(resultSignals(item.result));
  const flags = resultFlags(item.result);
  const candidates = resultCandidates(item.result);

  /**
   * The three allocation cells of one line — class, student, charge. Rendered
   * from the same function for the row's own line and for a split's extra
   * rows, which is what keeps them in one column each.
   */
  const allocationCells = (line: ChargeLine, i: number) => {
    const options = chargeOptionsFor(line);
    const chargeLabel = line.chargeId
      ? options.find((o) => o.value === String(line.chargeId))?.label ?? null
      : null;
    const student = studentById.get(line.studentId) ?? null;
    const cls = classFilterFor(i);
    return (
      <>
        <Select
          items={{
            [ALL_CLASSES]: strings.triage.controls.classAll,
            ...Object.fromEntries(classes.map((c) => [c.gradeName, c.gradeName])),
          }}
          value={cls ?? ALL_CLASSES}
          onValueChange={(v) => setLineClass(i, v === ALL_CLASSES ? null : v)}
        >
          <SelectTrigger
            size="sm"
            className={cn(WRAPPING_TRIGGER, "min-w-0", ALLOCATION_COL_START)}
            aria-label={strings.triage.controls.classLabel}
          >
            <span className="min-w-0 flex-1">
              {cls ?? strings.triage.controls.classAll}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>
              {strings.triage.controls.classAll}
            </SelectItem>
            {classes.map((c) => (
              <SelectItem
                key={`${c.gradeLevelCode}-${c.gradeName}`}
                value={c.gradeName}
              >
                {c.gradeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Combobox
          items={studentsFor(i)}
          value={student}
          onValueChange={(s) => setLineStudent(i, s as ReviewStudent | null)}
          itemToStringLabel={(s: ReviewStudent) => `${s.lastName} ${s.firstName}`}
        >
          <ComboboxTrigger
            className={cn(WRAPPING_TRIGGER, "h-auto")}
            aria-label={strings.triage.controls.studentValue}
          >
            <span className="min-w-0 flex-1 break-words">
              {student
                ? `${student.lastName} ${student.firstName}`
                : strings.triage.controls.studentNone}
            </span>
          </ComboboxTrigger>
          <ComboboxContent>
            <ComboboxInputGroup>
              <ComboboxInput
                placeholder={strings.triage.controls.studentPlaceholder}
              />
            </ComboboxInputGroup>
            <ComboboxList>
              {(s: ReviewStudent) => (
                <ComboboxItem key={s.id} value={s}>
                  <span className="flex flex-col">
                    <span>
                      {s.lastName} {s.firstName}
                    </span>
                    {s.gradeName ? (
                      <span className="text-xs text-muted-foreground">
                        {s.gradeName}
                      </span>
                    ) : null}
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
            <ComboboxEmpty>{strings.triage.controls.studentNoMatch}</ComboboxEmpty>
          </ComboboxContent>
        </Combobox>

        <Select
          items={Object.fromEntries(options.map((o) => [o.value, o.label]))}
          value={line.chargeId ? String(line.chargeId) : ""}
          onValueChange={(v) => setLineCharge(i, v ? Number(v) : 0)}
          disabled={line.studentId === 0 || options.length === 0}
        >
          <SelectTrigger
            size="sm"
            className={WRAPPING_TRIGGER}
            aria-label={strings.form.charge}
          >
            <span
              className={cn(
                "min-w-0 flex-1 break-words",
                !chargeLabel && "text-muted-foreground",
              )}
            >
              {chargeLabel ??
                (line.studentId > 0 && options.length === 0
                  ? strings.triage.controls.noOpenCharges
                  : strings.triage.controls.chargePlaceholder)}
            </span>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </>
    );
  };

  /** How much of the transfer this line pays — editable only while splitting. */
  const amountCell = (line: ChargeLine, i: number) => (
    <Input
      type="number"
      min={1}
      step={1000}
      className="w-full"
      aria-label={strings.triage.split.amountLabel(i + 1)}
      placeholder={strings.triage.split.amountPlaceholder}
      value={line.amount === 0 ? "" : line.amount}
      onChange={(e) =>
        setLineAmount(i, e.target.value === "" ? 0 : Number(e.target.value))
      }
    />
  );

  return (
    <div
      className={cn(
        "rounded-lg border border-border",
        MIN_ROW_WIDTH,
        selected && selectable && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      {/* Interactive editor — one grid row per transaction. */}
      <div className={cn(ROW_GRID, "px-2 py-1.5 text-sm")}>
        {/* Checkbox and expander share one cell. Rows in groups with no bulk
            action carry no checkbox, and the expander slides left into the space
            instead of leaving a hole at the start of every row. */}
        <div className="flex h-7 items-center gap-0.5">
          {selectable ? (
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={expanded ? strings.triage.collapse : strings.triage.expand}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
          </Button>
        </div>

        {/* Memo — what the payer wrote, in full: it is what the reviewer reads
            to decide, so it wraps and the row grows. The bank's appended
            "(GOLOMT BANK …)" block is dropped because the same counterparty is
            already on the row as Sender and Account; hovering shows the raw
            memo, and what is stored is untouched. */}
        <span
          className="min-w-0 self-center py-0.5 break-words text-foreground"
          title={t.memo ?? ""}
        >
          {displayMemo ?? (
            <span className="text-muted-foreground">{strings.triage.noMemo}</span>
          )}
        </span>

        {/* Amount — the other half of what the bank sent, so it reads with the
            memo. The rule marks where the bank's side ends and the allocation
            begins; it stretches so it spans however tall the memo made the row. */}
        <span className="flex self-stretch items-center justify-end border-r border-border pr-3 tabular-nums font-medium">
          {fmt(txAmount)}
        </span>

        {allocationCells(lines[0]!, 0)}

        {/* Last allocation column: how much this line takes while splitting,
            and otherwise the control that starts a split. */}
        {splitMode ? (
          amountCell(lines[0]!, 0)
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start px-2"
            onClick={toggleSplit}
            disabled={lines[0]!.studentId === 0}
          >
            {strings.triage.split.enable}
          </Button>
        )}

        {/* Actions. The row no longer says *why* it needs attention — that is
            the group heading's job now, stated once instead of on every row. */}
        <div className="flex items-start justify-end gap-1">
          <Button
            type="button"
            size="sm"
            disabled={!confirmable || confirming}
            onClick={() => void runConfirm()}
          >
            {confirming
              ? strings.triage.confirmPending
              : creatingCharge
                ? strings.triage.addFeeAndConfirm
                : strings.triage.confirm}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={strings.triage.discard}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      {/* The rest of the split: one charge row per line, in the same columns as
          the row above — same student for a child paying two fees, a sibling's
          class and name for a shared transfer. */}
      {splitMode ? (
        <div className="flex flex-col gap-1.5 px-2 pb-2">
          {lines.slice(1).map((line, idx) => {
            const i = idx + 1;
            return (
              <div key={i} className={cn(ROW_GRID, "text-sm")}>
                {allocationCells(line, i)}
                {amountCell(line, i)}
                <div className="flex items-start justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={strings.triage.split.remove}
                    onClick={() => removeLine(i)}
                  >
                    <XIcon />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className={cn(ROW_GRID, "text-xs")}>
            <div
              className={cn(
                ALLOCATION_COL_START,
                "col-span-3 flex flex-wrap items-center gap-2",
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="xs"
                data-icon="inline-start"
                onClick={addLine}
              >
                <PlusIcon />
                {strings.triage.split.addCharge}
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={toggleSplit}>
                {strings.triage.split.disable}
              </Button>
            </div>
            <span
              className={cn(
                "col-span-2 self-center",
                allocated === txAmount ? "text-success" : "text-destructive",
              )}
            >
              {strings.triage.split.allocated(allocated, txAmount)}
            </span>
          </div>
        </div>
      ) : null}

      {rowError ? (
        <div className="px-3 pb-2 text-xs text-destructive">{rowError}</div>
      ) : null}

      {/* Read-only details + matching explanation. */}
      {expanded ? (
        <div className="flex flex-col gap-3 border-t border-border p-3 text-xs">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">
                {strings.triage.info.sender}:
              </span>{" "}
              {t.senderName ?? "—"}
            </span>
            {t.senderAccount ? (
              <span>
                <span className="font-medium text-foreground">
                  {strings.triage.info.account}:
                </span>{" "}
                <span className="font-mono">{t.senderAccount}</span>
              </span>
            ) : null}
            <span>
              <span className="font-medium text-foreground">
                {strings.triage.info.reference}:
              </span>{" "}
              <span className="font-mono">{t.transactionId}</span>
            </span>
            <span>
              <span className="font-medium text-foreground">
                {strings.triage.info.date}:
              </span>{" "}
              {fmtDate(t.transactionAt)}
            </span>
          </div>

          {signals.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-muted-foreground">
                {strings.triage.info.matchedOn}:
              </span>
              {signals.map((c) => (
                <Badge key={c} variant="secondary">
                  {strings.signals.rollup[c]}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">
              {strings.triage.info.noSignals}
            </div>
          )}

          {item.result.kind === "unmatched" ? (
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">
                {strings.triage.info.reason}:
              </span>{" "}
              {strings.unmatched.reason[item.result.reason]}
            </div>
          ) : null}

          {flags.length > 0 ? (
            <ul className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-destructive">
              {flags.map((f) => (
                <li key={f}>⚠ {strings.flags[f]}</li>
              ))}
            </ul>
          ) : null}

          {/* Every candidate, best first — including the one the matcher filled
              in. Listing only the others meant that trying an alternative threw
              the original away: there was nothing left on screen to switch back
              to. Whichever candidate the row currently holds reads as a chip,
              not a button. */}
          {candidates.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">
                {strings.triage.info.candidates}:
              </span>
              {candidates.map((p) => {
                const s = studentById.get(p.studentId);
                const name = s
                  ? `${s.lastName} ${s.firstName}`
                  : `#${p.studentId}`;
                return lines.some((l) => l.studentId === p.studentId) ? (
                  <Badge key={p.studentId} variant="secondary">
                    {strings.triage.info.currentCandidate(name)}
                  </Badge>
                ) : (
                  <Button
                    key={p.studentId}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => applyCandidate(p)}
                  >
                    {strings.triage.info.apply(name)}
                  </Button>
                );
              })}
            </div>
          ) : null}

          <div>
            <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
              {strings.triage.skip}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{strings.form.deleteDialogTitle}</DialogTitle>
            <DialogDescription>
              {strings.form.deleteDialogBody}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <span className="font-medium">{t.senderName ?? "—"}</span>
            {" · "}
            <span className="tabular-nums">{fmt(t.amount)} MNT</span>
            {" · "}
            <span className="text-muted-foreground">
              {fmtDate(t.transactionAt)}
            </span>
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
              {deleting
                ? strings.form.deletePending
                : strings.form.deleteDialogConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
