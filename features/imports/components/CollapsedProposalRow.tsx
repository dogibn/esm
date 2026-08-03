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
  editCreatesCharge,
  editSum,
  isEditConfirmable,
  resultAlternatives,
  resultFlags,
  resultSignals,
  rollupSignals,
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
 * where it goes (class → student → charge). The amount is sized for eight
 * digits and no more.
 *
 * The row is wider than a small screen; the list scrolls sideways rather than
 * squashing the columns (see MIN_ROW_WIDTH).
 */
const ROW_GRID =
  "grid grid-cols-[3rem_minmax(14rem,1fr)_5.5rem_5.5rem_9.5rem_11.5rem_6rem_10.5rem] items-start gap-x-2";
const MIN_ROW_WIDTH = "min-w-[70rem]";

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

  const selectedStudent = studentById.get(edit.studentId) ?? null;
  const [classFilter, setClassFilter] = useState<string | null>(
    () => selectedStudent?.gradeName ?? null,
  );
  const [splitOpen, setSplitOpen] = useState(edit.lines.length > 1);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const splitMode = splitOpen || edit.lines.length > 1;
  const confirmable = isEditConfirmable(edit, txAmount);
  const openCharges = openChargesByStudent.get(edit.studentId) ?? [];
  // The matcher's proposed fee only stands while its student is selected —
  // "create a bus charge" is a statement about *this* child.
  const newCharge =
    edit.newCharge && edit.studentId > 0 ? edit.newCharge : undefined;
  const creatingCharge = editCreatesCharge(edit);
  const chargeOptions: Array<{ value: string; label: string }> = [
    ...openCharges.map((c) => ({
      value: String(c.id),
      label: `${c.feeName} · ${fmt(c.outstandingBalance)}`,
    })),
    ...(newCharge
      ? [
          {
            value: NEW_CHARGE_VALUE,
            label: strings.triage.controls.addFeeOption(
              newCharge.feeName,
              fmt(newCharge.amount),
            ),
          },
        ]
      : []),
  ];

  const selectedChargeValue = edit.lines[0]?.chargeId
    ? String(edit.lines[0]?.chargeId)
    : "";
  const chargeLabelOf = (value: string) =>
    chargeOptions.find((o) => o.value === value)?.label ?? null;
  const selectedChargeLabel = chargeLabelOf(selectedChargeValue);
  const lineChargeLabel = (chargeId: number) =>
    chargeId ? chargeLabelOf(String(chargeId)) : null;

  const filteredStudents = useMemo(
    () =>
      classFilter === null
        ? allStudents
        : allStudents.filter((s) => s.gradeName === classFilter),
    [allStudents, classFilter],
  );

  // Editing helpers — all funnel through onEditChange so ReviewTable stays the
  // single source of truth.
  const setStudent = (s: ReviewStudent | null) => {
    // Switching students invalidates the chosen charge(s) — and any fee the
    // matcher proposed creating, which was about the student it picked.
    onEditChange({ studentId: s ? s.id : 0, lines: [] });
    if (s) setClassFilter(s.gradeName ?? null);
    setRowError(null);
  };

  const changeClass = (cls: string | null) => {
    setClassFilter(cls);
    // Bug fix: if the selected student isn't in the new class, clear it so a
    // stale student can't stay attached to the wrong class.
    if (
      cls !== null &&
      edit.studentId > 0 &&
      studentById.get(edit.studentId)?.gradeName !== cls
    ) {
      onEditChange({ studentId: 0, lines: [] });
    }
  };

  // A charge id of 0 means "nothing selected"; the negative placeholder means
  // the fee being created, which is a real selection.
  const isChosen = (chargeId: number) =>
    chargeId > 0 || chargeId === NEW_CHARGE_PLACEHOLDER_ID;

  const setSingleCharge = (chargeId: number) => {
    onEditChange({
      ...edit,
      studentId: edit.studentId,
      lines: isChosen(chargeId) ? [{ chargeId, amount: txAmount }] : [],
    });
    setRowError(null);
  };

  const toggleSplit = () => {
    if (splitMode) {
      // Collapse back to a single charge line at the full amount.
      const first = edit.lines.find((l) => isChosen(l.chargeId));
      onEditChange({
        ...edit,
        studentId: edit.studentId,
        lines: first ? [{ chargeId: first.chargeId, amount: txAmount }] : [],
      });
      setSplitOpen(false);
    } else {
      setSplitOpen(true);
    }
  };

  const addChargeLine = () =>
    onEditChange({ ...edit, lines: [...edit.lines, { chargeId: 0, amount: 0 }] });
  const removeChargeLine = (i: number) =>
    onEditChange({ ...edit, lines: edit.lines.filter((_, idx) => idx !== i) });
  const setLineCharge = (i: number, chargeId: number) =>
    onEditChange({
      ...edit,
      lines: edit.lines.map((l, idx) => (idx === i ? { ...l, chargeId } : l)),
    });
  const setLineAmount = (i: number, amount: number) =>
    onEditChange({
      ...edit,
      lines: edit.lines.map((l, idx) => (idx === i ? { ...l, amount } : l)),
    });

  const applyAlternative = (p: MatchProposalWire) => {
    onEditChange({
      studentId: p.studentId,
      lines: p.allocations.map((a) => ({ chargeId: a.chargeId, amount: a.amount })),
      // The alternative may come with its own missing fee — a sibling who also
      // has no bus charge, say — so it travels with the switch.
      ...(p.proposedCharge ? { newCharge: p.proposedCharge } : {}),
    });
    setClassFilter(studentById.get(p.studentId)?.gradeName ?? null);
    setSplitOpen(p.allocations.length > 1);
    setRowError(null);
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

  const allocated = editSum(edit);
  const signals = rollupSignals(resultSignals(item.result));
  const flags = resultFlags(item.result);
  const alternatives = resultAlternatives(item.result);

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

        {/* Allocation: class → student → charge, one grid column each. */}
        <Select
          items={{
            [ALL_CLASSES]: strings.triage.controls.classAll,
            ...Object.fromEntries(classes.map((c) => [c.gradeName, c.gradeName])),
          }}
          value={classFilter ?? ALL_CLASSES}
          onValueChange={(v) => changeClass(v === ALL_CLASSES ? null : v)}
        >
          <SelectTrigger size="sm" className={cn(WRAPPING_TRIGGER, "min-w-0")}>
            <span className="min-w-0 flex-1">
              {classFilter ?? strings.triage.controls.classAll}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>
              {strings.triage.controls.classAll}
            </SelectItem>
            {classes.map((c) => (
              <SelectItem key={`${c.gradeLevelCode}-${c.gradeName}`} value={c.gradeName}>
                {c.gradeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Combobox
          items={filteredStudents}
          value={selectedStudent}
          onValueChange={(s) => setStudent(s as ReviewStudent | null)}
          itemToStringLabel={(s: ReviewStudent) =>
            `${s.lastName} ${s.firstName}`
          }
        >
          <ComboboxTrigger className={cn(WRAPPING_TRIGGER, "h-auto")}>
            <span className="min-w-0 flex-1 break-words">
              {selectedStudent
                ? `${selectedStudent.lastName} ${selectedStudent.firstName}`
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
            <ComboboxEmpty>
              {strings.triage.controls.studentNoMatch}
            </ComboboxEmpty>
          </ComboboxContent>
        </Combobox>

        {/* Single-charge select (hidden while splitting). */}
        {!splitMode ? (
          <Select
            items={Object.fromEntries(chargeOptions.map((o) => [o.value, o.label]))}
            value={selectedChargeValue}
            onValueChange={(v) => setSingleCharge(v ? Number(v) : 0)}
            disabled={edit.studentId === 0 || chargeOptions.length === 0}
          >
            <SelectTrigger size="sm" className={WRAPPING_TRIGGER}>
              <span
                className={cn(
                  "min-w-0 flex-1 break-words",
                  !selectedChargeLabel && "text-muted-foreground",
                )}
              >
                {selectedChargeLabel ?? strings.triage.controls.chargePlaceholder}
              </span>
            </SelectTrigger>
            <SelectContent>
              {chargeOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          // Split mode: the charges are listed in full below, so this slot only
          // says how many. Bordered like the select it replaces — as bare text
          // it read as a stray label floating between two controls.
          <span className="flex min-h-7 w-fit items-center rounded-lg border border-dashed border-input px-2 text-xs text-muted-foreground">
            {strings.triage.split.acrossCharges(edit.lines.length)}
          </span>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start px-2"
          onClick={toggleSplit}
          disabled={edit.studentId === 0}
        >
          {splitMode ? strings.triage.split.disable : strings.triage.split.enable}
        </Button>

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

      {/* Split editor — one student, several charges summing to the transfer. */}
      {splitMode ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
          {edit.lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2">
              <Select
                items={Object.fromEntries(chargeOptions.map((o) => [o.value, o.label]))}
                value={line.chargeId ? String(line.chargeId) : ""}
                onValueChange={(v) => setLineCharge(i, v ? Number(v) : 0)}
                disabled={edit.studentId === 0}
              >
                <SelectTrigger
                  size="sm"
                  className={cn(WRAPPING_TRIGGER, "w-64 shrink-0")}
                >
                  <span
                    className={cn(
                      "min-w-0 flex-1 break-words",
                      !lineChargeLabel(line.chargeId) && "text-muted-foreground",
                    )}
                  >
                    {lineChargeLabel(line.chargeId) ??
                      strings.triage.controls.chargePlaceholder}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {chargeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                step={1000}
                className="w-36 shrink-0"
                value={line.amount === 0 ? "" : line.amount}
                onChange={(e) =>
                  setLineAmount(i, e.target.value === "" ? 0 : Number(e.target.value))
                }
                placeholder={strings.columns.amount}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={strings.triage.split.remove}
                onClick={() => removeChargeLine(i)}
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-icon="inline-start"
              onClick={addChargeLine}
              disabled={edit.studentId === 0}
            >
              <PlusIcon />
              {strings.triage.split.addCharge}
            </Button>
            <span
              className={cn(
                "text-xs",
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

          {alternatives.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground">
                {strings.triage.info.alternatives}:
              </span>
              {alternatives.map((p) => {
                const s = studentById.get(p.studentId);
                const name = s
                  ? `${s.lastName} ${s.firstName}`
                  : `#${p.studentId}`;
                return (
                  <Button
                    key={p.studentId}
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => applyAlternative(p)}
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
