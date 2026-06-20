"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
  useFormContext,
  useWatch,
} from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  AllocationFlag,
  MatchProposalWire,
  MatchResultWire,
  ProposalListItemWire,
  ReviewContext,
  SignalKind,
} from "../types";
import { allocationFormSchema, type AllocationFormValues } from "../schemas";
import { strings } from "../strings";

// ----------------------------------------------------------------------
// Signal rollup — 4 domain-model categories. Granular SignalKind sub-types
// are kept in `title` hover for debugging.
// ----------------------------------------------------------------------

type SignalCategory = "memo_grade" | "memo_name" | "account" | "amount";

const SIGNAL_CATEGORY: Record<SignalKind, SignalCategory | null> = {
  memo_grade_class: "memo_grade",
  memo_grade_wildcard: "memo_grade",
  memo_grade_level: "memo_grade",
  memo_name_full: "memo_name",
  memo_name_partial: "memo_name",
  memo_name_fuzzy: "memo_name",
  sender_account: "account",
  fee_hint_from_amount: "amount",
  fee_inferred_from_amount: "amount",
  // fee_hint_explicit doesn't fit the 4-category domain model cleanly; shown
  // in the granular hover only.
  fee_hint_explicit: null,
};

function rollupSignals(signals: SignalKind[]): SignalCategory[] {
  const out = new Set<SignalCategory>();
  for (const s of signals) {
    const cat = SIGNAL_CATEGORY[s];
    if (cat) out.add(cat);
  }
  return [...out];
}

function allSignalsFromResult(result: MatchResultWire): SignalKind[] {
  const out = new Set<SignalKind>();
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      for (const p of result.proposals) for (const s of p.signals) out.add(s);
      break;
    case "matched_multi":
      for (const p of result.proposal.proposals) for (const s of p.signals) out.add(s);
      break;
    case "unmatched":
      break;
  }
  return [...out];
}

function allFlagsFromResult(result: MatchResultWire): AllocationFlag[] {
  const out = new Set<AllocationFlag>();
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      for (const p of result.proposals) for (const f of p.flags) out.add(f);
      break;
    case "matched_multi":
      for (const p of result.proposal.proposals) for (const f of p.flags) out.add(f);
      break;
    case "unmatched":
      break;
  }
  return [...out];
}

// ----------------------------------------------------------------------
// Initial form values derived from MatchResultWire kind.
// ----------------------------------------------------------------------

const ZERO_LINE = { studentId: 0, chargeId: 0, amount: 0 };

function linesFromProposal(p: MatchProposalWire) {
  if (p.allocations.length === 0) {
    return [{ ...ZERO_LINE, studentId: p.studentId }];
  }
  return p.allocations.map((a) => ({
    studentId: p.studentId,
    chargeId: a.chargeId,
    amount: a.amount,
  }));
}

function initialValues(
  bankTransactionId: number,
  result: MatchResultWire,
): AllocationFormValues {
  switch (result.kind) {
    case "matched":
    case "low_confidence": {
      const p = result.proposals[0];
      if (!p) return { bankTransactionId, lines: [{ ...ZERO_LINE }] };
      return { bankTransactionId, lines: linesFromProposal(p) };
    }
    case "matched_multi": {
      const lines = result.proposal.proposals.flatMap(linesFromProposal);
      return {
        bankTransactionId,
        lines: lines.length > 0 ? lines : [{ ...ZERO_LINE }],
      };
    }
    case "unmatched":
      return { bankTransactionId, lines: [{ ...ZERO_LINE }] };
  }
}

// Alternative candidates the accountant can apply with one click. The first
// proposal is already pre-filled, so it's excluded.
function alternativeProposals(result: MatchResultWire): MatchProposalWire[] {
  switch (result.kind) {
    case "matched":
    case "low_confidence":
      return result.proposals.slice(1);
    case "matched_multi":
    case "unmatched":
      return [];
  }
}

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

const ALL_CLASSES = "__all__";

type Props = {
  proposal: ProposalListItemWire;
  context: ReviewContext;
  /** Resolves on success; rejects with an Error whose message is shown inline. */
  onConfirm: (values: AllocationFormValues) => Promise<void>;
  onDelete: () => void;
  onSkip: () => void;
};

export function AllocationForm({
  proposal,
  context,
  onConfirm,
  onDelete,
  onSkip,
}: Props) {
  const form = useForm<AllocationFormValues>({
    resolver: zodResolver(allocationFormSchema),
    defaultValues: initialValues(proposal.bankTransactionId, proposal.result),
    mode: "onSubmit",
  });
  const { control, handleSubmit, watch, reset } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const lines = watch("lines");
  const txAmount = proposal.transactionPreview.amount;
  const linesSum = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const balanced = linesSum === txAmount;

  const granularSignals = useMemo(
    () => allSignalsFromResult(proposal.result),
    [proposal.result],
  );
  const rolledSignals = useMemo(
    () => rollupSignals(granularSignals),
    [granularSignals],
  );
  const flags = useMemo(
    () => allFlagsFromResult(proposal.result),
    [proposal.result],
  );
  const alternatives = useMemo(
    () => alternativeProposals(proposal.result),
    [proposal.result],
  );

  const studentById = useMemo(
    () => new Map(context.students.map((s) => [s.id, s])),
    [context.students],
  );

  // Per-line context — a memo of openCharges keyed by studentId for fast lookup.
  const openChargesByStudent = useMemo(() => {
    const m = new Map<number, typeof context.openCharges>();
    for (const c of context.openCharges) {
      let arr = m.get(c.studentId);
      if (!arr) {
        arr = [];
        m.set(c.studentId, arr);
      }
      arr.push(c);
    }
    return m;
  }, [context.openCharges]);

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      await onConfirm(values);
      // On success the parent removes this row; no local state to reset.
    } catch (e) {
      setServerError((e as Error).message);
      setSubmitting(false);
    }
  });

  const applyAlternative = (p: MatchProposalWire) => {
    reset({
      bankTransactionId: proposal.bankTransactionId,
      lines: linesFromProposal(p),
    });
    setServerError(null);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
        {/* Signals — system's guess */}
        {rolledSignals.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-1"
            title={granularSignals
              .map((s) => strings.signals.granular[s])
              .join("\n")}
          >
            <span className="text-xs text-muted-foreground">Matched on:</span>
            {rolledSignals.map((cat) => (
              <Badge key={cat} variant="secondary">
                {strings.signals.rollup[cat]}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Unmatched reason */}
        {proposal.result.kind === "unmatched" ? (
          <div className="text-sm text-muted-foreground">
            {strings.unmatched.reason[proposal.result.reason]}
          </div>
        ) : null}

        {/* Alternative candidates — one click applies that student's proposal */}
        {alternatives.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {strings.form.suggestions}
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
                  {strings.form.applySuggestion(name)}
                </Button>
              );
            })}
          </div>
        ) : null}

        {/* Flag warnings — inline, distinct from signals */}
        {flags.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
            {flags.map((f) => (
              <li key={f}>⚠ {strings.flags[f]}</li>
            ))}
          </ul>
        ) : null}

        {/* Allocation lines */}
        <div className="flex flex-col gap-2">
          {fields.map((field, index) => (
            <LineRow
              key={field.id}
              index={index}
              context={context}
              openChargesByStudent={openChargesByStudent}
              txAmount={txAmount}
              removable={fields.length > 1}
              onRemove={() => remove(index)}
            />
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...ZERO_LINE })}
            >
              {strings.form.addLine}
            </Button>
          </div>
        </div>

        {serverError ? (
          <div className="text-sm text-destructive">{serverError}</div>
        ) : null}

        {/* Totals + actions in one row — the colored diff explains why
            Confirm is disabled, so no separate hint line. */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{strings.form.txAmount(txAmount)}</span>
            <span>{strings.form.sumOfLines(linesSum)}</span>
            <span
              className={
                balanced
                  ? "font-medium text-foreground"
                  : linesSum > txAmount
                    ? "font-medium text-destructive"
                    : "font-medium"
              }
            >
              {strings.form.diff(linesSum - txAmount)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSkip}
              disabled={submitting}
            >
              {strings.form.skip}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={submitting}
            >
              {strings.form.delete}
            </Button>
            <Button type="submit" size="sm" disabled={!balanced || submitting}>
              {submitting ? strings.form.confirmPending : strings.form.confirm}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}

// ----------------------------------------------------------------------
// Line row — class filter → student → charge → amount.
// ----------------------------------------------------------------------

type LineRowProps = {
  index: number;
  context: ReviewContext;
  openChargesByStudent: Map<number, ReviewContext["openCharges"]>;
  txAmount: number;
  removable: boolean;
  onRemove: () => void;
};

function LineRow({
  index,
  context,
  openChargesByStudent,
  txAmount,
  removable,
  onRemove,
}: LineRowProps) {
  const { control, getValues, setValue } =
    useFormContext<AllocationFormValues>();
  const studentId = useWatch({ control, name: `lines.${index}.studentId` });

  // The class filter is local UI state, not in form data — it just narrows
  // the student dropdown. It defaults to the selected student's class (so a
  // matched proposal shows its class here), and a manual choice sticks until
  // the student changes, at which point it re-syncs to the new student.
  const selectedGrade =
    context.students.find((s) => s.id === studentId)?.gradeName ?? null;
  const [filterOverride, setFilterOverride] = useState<{
    forStudent: number;
    value: string | null;
  } | null>(null);
  const classFilter =
    filterOverride && filterOverride.forStudent === studentId
      ? filterOverride.value
      : selectedGrade;
  const setClassFilter = (value: string | null) =>
    setFilterOverride({ forStudent: studentId, value });

  const filteredStudents = useMemo(() => {
    if (classFilter === null) return context.students;
    return context.students.filter((s) => s.gradeName === classFilter);
  }, [context.students, classFilter]);

  // Picking a charge with the amount still empty prefills the remaining
  // unallocated amount (capped at the charge's outstanding balance) — the
  // common case is "this transfer pays exactly this charge".
  const prefillAmount = (chargeId: number) => {
    const values = getValues();
    const current = values.lines[index];
    if (!current || current.amount !== 0) return;
    const othersSum = values.lines.reduce(
      (s, l, i) => (i === index ? s : s + (Number(l.amount) || 0)),
      0,
    );
    const remaining = txAmount - othersSum;
    if (remaining <= 0) return;
    const charge = (openChargesByStudent.get(current.studentId) ?? []).find(
      (c) => c.id === chargeId,
    );
    const cap = charge && charge.outstandingBalance > 0
      ? Math.min(remaining, charge.outstandingBalance)
      : remaining;
    setValue(`lines.${index}.amount`, cap, { shouldValidate: false });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        removable && "rounded-md border border-border p-2",
      )}
    >
      {/* Per-line chrome only matters once there's more than one line. */}
      {removable ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{strings.form.lineHeading(index)}</span>
          <Button type="button" variant="ghost" size="xs" onClick={onRemove}>
            {strings.form.removeLine}
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[8rem_minmax(12rem,1.2fr)_minmax(12rem,1fr)_7rem]">
        {/* Class filter (local to this line) — narrows the student combobox.
            NOT part of the form payload; it's purely a UI filter. */}
        <Select
          items={{
            [ALL_CLASSES]: strings.form.classFilterAll,
            ...Object.fromEntries(
              context.classes.map((c) => [c.gradeName, c.gradeName]),
            ),
          }}
          value={classFilter ?? ALL_CLASSES}
          onValueChange={(v) =>
            setClassFilter(v === null || v === ALL_CLASSES ? null : v)
          }
        >
          <SelectTrigger size="sm">
            <SelectValue placeholder={strings.form.classFilterAll} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>{strings.form.classFilterAll}</SelectItem>
            {context.classes.map((c) => (
              <SelectItem key={`${c.gradeLevelCode}-${c.gradeName}`} value={c.gradeName}>
                {c.gradeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Student combobox — switching students resets the charge, which
            belongs to the previous student and would otherwise go stale. */}
        <Controller
          control={control}
          name={`lines.${index}.studentId`}
          render={({ field }) => {
            const selected =
              context.students.find((s) => s.id === field.value) ?? null;
            return (
              <Combobox
                items={filteredStudents}
                value={selected}
                onValueChange={(s) => {
                  const nextId = s ? s.id : 0;
                  if (nextId !== field.value) {
                    setValue(`lines.${index}.chargeId`, 0, {
                      shouldValidate: false,
                    });
                  }
                  field.onChange(nextId);
                }}
                itemToStringLabel={(s) => `${s.lastName} ${s.firstName}`}
              >
                <ComboboxTrigger>
                  <ComboboxValue>
                    {selected
                      ? `${selected.lastName} ${selected.firstName}`
                      : strings.form.studentNotSelected}
                  </ComboboxValue>
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInputGroup>
                    <ComboboxInput placeholder={strings.form.studentPlaceholder} />
                  </ComboboxInputGroup>
                  <ComboboxList>
                    {(item: ReviewContext["students"][number]) => (
                      <ComboboxItem key={item.id} value={item}>
                        <span className="flex flex-col">
                          <span>
                            {item.lastName} {item.firstName}
                          </span>
                          {item.gradeName ? (
                            <span className="text-xs text-muted-foreground">
                              {item.gradeName}
                            </span>
                          ) : null}
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                  <ComboboxEmpty>{strings.form.studentNoMatch}</ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
            );
          }}
        />

        {/* Charge select — populated from selected student's open charges */}
        <Controller
          control={control}
          name={`lines.${index}.chargeId`}
          render={({ field }) => {
            const charges = openChargesByStudent.get(studentId) ?? [];
            const noOpen = studentId !== 0 && charges.length === 0;
            return (
              <div className="flex flex-col gap-1">
                <Select
                  items={Object.fromEntries(
                    charges.map((c) => [
                      String(c.id),
                      `${c.feeName} — ${c.outstandingBalance.toLocaleString("en-US")} MNT`,
                    ]),
                  )}
                  value={field.value === 0 ? "" : String(field.value)}
                  onValueChange={(v) => {
                    const nextId = v ? Number(v) : 0;
                    field.onChange(nextId);
                    if (nextId !== 0) prefillAmount(nextId);
                  }}
                  disabled={studentId === 0 || noOpen}
                >
                  <SelectTrigger size="sm">
                    <SelectValue placeholder={strings.form.chargePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {charges.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.feeName} —{" "}
                        {c.outstandingBalance.toLocaleString("en-US")} MNT
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {noOpen ? (
                  <span className="text-xs text-destructive">
                    ⚠ {strings.flags.no_open_charges}
                  </span>
                ) : null}
              </div>
            );
          }}
        />

        {/* Amount */}
        <Controller
          control={control}
          name={`lines.${index}.amount`}
          render={({ field, fieldState }) => (
            <div className="flex flex-col gap-1">
              <Input
                type="number"
                min={1}
                step={1}
                value={field.value === 0 ? "" : field.value}
                onChange={(e) =>
                  field.onChange(e.target.value === "" ? 0 : Number(e.target.value))
                }
                aria-invalid={fieldState.invalid}
                placeholder={strings.columns.amount}
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
