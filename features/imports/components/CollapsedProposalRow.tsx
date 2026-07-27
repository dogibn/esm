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
  ComboboxValue,
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
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  attentionReason,
  editSum,
  isEditConfirmable,
  resultAlternatives,
  resultFlags,
  resultSignals,
  rollupSignals,
  type ProposalTier,
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
  tier: ProposalTier;
  allStudents: ReviewStudent[];
  studentById: Map<number, ReviewStudent>;
  openChargesByStudent: Map<number, ReviewOpenCharge[]>;
  classes: ReviewClass[];
  edit: RowEdit;
  onEditChange: (next: RowEdit) => void;
  selected: boolean;
  onToggleSelect: () => void;
  onConfirm: () => Promise<void>;
  onDiscard: () => Promise<void>;
  onSkip: () => void;
};

export function CollapsedProposalRow({
  item,
  tier,
  allStudents,
  studentById,
  openChargesByStudent,
  classes,
  edit,
  onEditChange,
  selected,
  onToggleSelect,
  onConfirm,
  onDiscard,
  onSkip,
}: Props) {
  const t = item.transactionPreview;
  const txAmount = t.amount;
  const isConfident = tier === "confident";

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
    // Switching students invalidates the chosen charge(s).
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

  const setSingleCharge = (chargeId: number) => {
    onEditChange({
      studentId: edit.studentId,
      lines: chargeId > 0 ? [{ chargeId, amount: txAmount }] : [],
    });
    setRowError(null);
  };

  const toggleSplit = () => {
    if (splitMode) {
      // Collapse back to a single charge line at the full amount.
      const first = edit.lines.find((l) => l.chargeId > 0);
      onEditChange({
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
        selected && isConfident && "border-primary/40 bg-primary/[0.03]",
      )}
    >
      {/* Interactive one-line editor */}
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 text-sm">
        {isConfident ? (
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} />
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
          className="min-w-0 flex-1 basis-40 truncate text-foreground"
          title={t.memo ?? ""}
        >
          {t.memo ?? (
            <span className="text-muted-foreground">{strings.triage.noMemo}</span>
          )}
        </span>

        {/* Inline controls: class → student → charge. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Select
            items={{
              [ALL_CLASSES]: strings.triage.controls.classAll,
              ...Object.fromEntries(classes.map((c) => [c.gradeName, c.gradeName])),
            }}
            value={classFilter ?? ALL_CLASSES}
            onValueChange={(v) => changeClass(v === ALL_CLASSES ? null : v)}
          >
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder={strings.triage.controls.classAll} />
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
            itemToStringLabel={(s: ReviewStudent) => `${s.lastName} ${s.firstName}`}
          >
            <ComboboxTrigger className="w-44">
              <ComboboxValue>
                {selectedStudent
                  ? `${selectedStudent.lastName} ${selectedStudent.firstName}`
                  : strings.triage.controls.studentNone}
              </ComboboxValue>
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
              items={Object.fromEntries(
                openCharges.map((c) => [
                  String(c.id),
                  `${c.feeName} · ${fmt(c.outstandingBalance)}`,
                ]),
              )}
              value={edit.lines[0]?.chargeId ? String(edit.lines[0]?.chargeId) : ""}
              onValueChange={(v) => setSingleCharge(v ? Number(v) : 0)}
              disabled={edit.studentId === 0 || openCharges.length === 0}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder={strings.triage.controls.chargePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {openCharges.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.feeName} · {fmt(c.outstandingBalance)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant="outline">{strings.triage.split.enable}</Badge>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleSplit}
            disabled={edit.studentId === 0}
          >
            {splitMode ? strings.triage.split.disable : strings.triage.split.enable}
          </Button>
        </div>

        {/* Amount. */}
        <span className="shrink-0 tabular-nums font-medium">{fmt(txAmount)}</span>

        {/* Status. */}
        {isConfident ? (
          <Badge variant="success">{strings.triage.balanced}</Badge>
        ) : (
          <Badge variant="warning">
            {strings.triage.reason[attentionReason(item.result, txAmount)]}
          </Badge>
        )}

        {/* Actions. */}
        <Button
          type="button"
          size="sm"
          disabled={!confirmable || confirming}
          onClick={() => void runConfirm()}
        >
          {confirming ? strings.triage.confirmPending : strings.triage.confirm}
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

      {/* Split editor — one student, several charges summing to the transfer. */}
      {splitMode ? (
        <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
          {edit.lines.map((line, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Select
                items={Object.fromEntries(
                  openCharges.map((c) => [
                    String(c.id),
                    `${c.feeName} · ${fmt(c.outstandingBalance)}`,
                  ]),
                )}
                value={line.chargeId ? String(line.chargeId) : ""}
                onValueChange={(v) => setLineCharge(i, v ? Number(v) : 0)}
                disabled={edit.studentId === 0}
              >
                <SelectTrigger size="sm" className="w-52">
                  <SelectValue placeholder={strings.triage.controls.chargePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {openCharges.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.feeName} · {fmt(c.outstandingBalance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                step={1000}
                className="w-36"
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
            <div className="text-muted-foreground">{strings.triage.info.noSignals}</div>
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
                const name = s ? `${s.lastName} ${s.firstName}` : `#${p.studentId}`;
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
            <DialogDescription>{strings.form.deleteDialogBody}</DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <span className="font-medium">{t.senderName ?? "—"}</span>
            {" · "}
            <span className="tabular-nums">{fmt(t.amount)} MNT</span>
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
