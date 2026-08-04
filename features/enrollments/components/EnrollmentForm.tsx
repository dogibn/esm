"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
// Pure calc from its module (not the barrel) to keep server-only code out of
// this client bundle.
import { computeTuition } from "@/features/discounts/calc";

import { createEnrollmentSchema, type CreateEnrollmentInput } from "../schemas";
import { strings } from "../strings";
import type { EnrollmentFormContext, ExistingStudentOption } from "../types";

type Props = {
  context: EnrollmentFormContext;
  initialMode: "new" | "existing";
};

function money(n: number): string {
  return `${n.toLocaleString("en-US")} MNT`;
}

// A sibling discount is recognised by its catalog name (no discount-type flag
// in v1). Only those rows offer a sibling link.
function isSiblingDiscount(name: string): boolean {
  return /sibling/i.test(name);
}

// A label + control + hint/error stack. Uses a div (not <label>) so custom
// Select/Combobox controls don't get double-focus behavior.
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

export function EnrollmentForm({ context, initialMode }: Props) {
  const router = useRouter();
  const [selectedStudent, setSelectedStudent] =
    useState<ExistingStudentOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<CreateEnrollmentInput>({
    resolver: zodResolver(createEnrollmentSchema),
    mode: "onSubmit",
    defaultValues: {
      mode: initialMode,
      existingStudentId: undefined,
      studentId: "",
      firstName: "",
      lastName: "",
      parentEmail: "",
      parentPhone: "",
      gradeId: 0,
      studentCategory: initialMode === "new" ? "new" : "old",
      tuitionContractId: "",
      studentCode: "",
      tuitionAmount: 0,
      registrationAmount: context.registrationFee ?? 0,
      discounts: [],
    },
  });
  const { control, handleSubmit, setValue, watch } = form;
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "discounts",
  });
  const errors = form.formState.errors;

  const mode = watch("mode");
  const category = watch("studentCategory");
  const tuitionAmount = watch("tuitionAmount");
  const registrationAmount = watch("registrationAmount");
  const discounts = watch("discounts");

  const typeById = useMemo(
    () => new Map(context.discountTypes.map((t) => [t.id, t])),
    [context.discountTypes],
  );

  // Resolve a form row to how it applies (unit/value), or null if incomplete.
  const resolveRow = (row: {
    discountTypeId?: number;
    value?: number | null;
  }): { unit: "mnt" | "percent"; value: number } | null => {
    const t = row.discountTypeId ? typeById.get(row.discountTypeId) : undefined;
    if (!t) return null;
    if (t.value !== null) return { unit: t.unit, value: t.value };
    const v = Number(row.value);
    if (!Number.isFinite(v) || row.value === null || row.value === undefined) return null;
    return { unit: t.unit, value: v };
  };

  // Live compounding preview: reductions align to resolvable rows, in order.
  const preview = useMemo(() => {
    const resolved = discounts.map(resolveRow);
    const applied = resolved
      .map((r, i) => (r ? { i, ...r } : null))
      .filter((x): x is { i: number; unit: "mnt" | "percent"; value: number } => x !== null);
    const comp = computeTuition(
      Number(tuitionAmount) || 0,
      applied.map((a) => ({ unit: a.unit, value: a.value })),
    );
    const amountByRow = new Map<number, number>();
    applied.forEach((a, idx) => amountByRow.set(a.i, comp.lines[idx]!.amount));
    return { net: comp.net, discountTotal: comp.discountTotal, amountByRow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discounts, tuitionAmount, typeById]);

  const discountTotal = preview.discountTotal;
  const netTuition = preview.net;
  const registrationApplied =
    category === "new" ? Number(registrationAmount) || 0 : 0;
  const grandTotal = netTuition + registrationApplied;

  const blockedExisting = mode === "existing" && !!selectedStudent?.enrolledThisYear;

  function changeMode(next: "new" | "existing") {
    setValue("mode", next);
    setServerError(null);
    if (next === "new") {
      setSelectedStudent(null);
      setValue("existingStudentId", undefined);
      setValue("studentId", "");
      setValue("firstName", "");
      setValue("lastName", "");
      setValue("parentEmail", "");
      setValue("parentPhone", "");
      setValue("studentCategory", "new");
    } else {
      setValue("studentCategory", "old");
    }
  }

  function pickStudent(s: ExistingStudentOption | null) {
    setSelectedStudent(s);
    if (!s) {
      setValue("existingStudentId", undefined);
      return;
    }
    setValue("existingStudentId", s.id);
    setValue("studentId", s.studentId);
    setValue("firstName", s.firstName);
    setValue("lastName", s.lastName);
    setValue("parentEmail", s.parentEmail ?? "");
    setValue("parentPhone", s.parentPhone ?? "");
  }

  function changeClass(gradeId: number) {
    setValue("gradeId", gradeId, { shouldValidate: true });
    const cls = context.classes.find((c) => c.gradeId === gradeId);
    if (cls) {
      const base = context.tuitionByGradeLevel[cls.gradeLevelCode];
      if (base !== undefined) setValue("tuitionAmount", base);
    }
  }

  const existingStudentId = watch("existingStudentId");
  // Only the returning student themselves is in the list; drop them so a
  // sibling can't point at the enrollee.
  const siblingOptions = useMemo(
    () => context.students.filter((s) => s.id !== existingStudentId),
    [context.students, existingStudentId],
  );

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      // Drop unselected rows; null a custom value for fixed types and a sibling
      // link for non-sibling types (server derives unit/name/amount anyway).
      const payload = {
        ...values,
        discounts: values.discounts
          .filter((d) => !!d.discountTypeId)
          .map((d) => {
            const t = typeById.get(d.discountTypeId);
            return {
              discountTypeId: d.discountTypeId,
              value: t && t.value === null ? (d.value ?? null) : null,
              notes: d.notes,
              siblingStudentId: isSiblingDiscount(t?.name ?? "")
                ? (d.siblingStudentId ?? null)
                : null,
            };
          }),
      };
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? strings.errors.generic);
      }
      const result = (await res.json()) as { studentDbId: number };
      router.push(`/students/${result.studentDbId}`);
      router.refresh();
    } catch (e) {
      setServerError((e as Error).message);
      setSubmitting(false);
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5">
      {/* Section 1 — Personal information */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{strings.personal.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {strings.personal.description}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Mode toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{strings.mode.label}</span>
            <div className="inline-flex w-fit rounded-lg bg-muted p-0.5">
              <Button
                type="button"
                variant={mode === "new" ? "default" : "ghost"}
                size="sm"
                onClick={() => changeMode("new")}
              >
                {strings.mode.new}
              </Button>
              <Button
                type="button"
                variant={mode === "existing" ? "default" : "ghost"}
                size="sm"
                onClick={() => changeMode("existing")}
              >
                {strings.mode.existing}
              </Button>
            </div>
          </div>

          {/* Existing-student picker */}
          {mode === "existing" ? (
            <Field
              label={strings.personal.pickLabel}
              error={
                errors.existingStudentId?.message as string | undefined
              }
            >
              <Combobox
                items={context.students}
                value={selectedStudent}
                onValueChange={(s) =>
                  pickStudent(s as ExistingStudentOption | null)
                }
                itemToStringLabel={(s: ExistingStudentOption) =>
                  `${s.lastName} ${s.firstName} ${s.studentId}`
                }
              >
                <ComboboxTrigger>
                  <ComboboxValue>
                    {selectedStudent
                      ? `${selectedStudent.lastName} ${selectedStudent.firstName}`
                      : strings.personal.pickNotSelected}
                  </ComboboxValue>
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInputGroup>
                    <ComboboxInput
                      placeholder={strings.personal.pickPlaceholder}
                    />
                  </ComboboxInputGroup>
                  <ComboboxList>
                    {(item: ExistingStudentOption) => (
                      <ComboboxItem key={item.id} value={item}>
                        <span className="flex flex-col">
                          <span>
                            {item.lastName} {item.firstName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.studentId}
                            {item.enrolledThisYear
                              ? ` · ${strings.mode.existing}`
                              : ""}
                          </span>
                        </span>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                  <ComboboxEmpty>{strings.personal.pickNoMatch}</ComboboxEmpty>
                </ComboboxContent>
              </Combobox>
              {blockedExisting ? (
                <span className="text-xs text-destructive">
                  {strings.personal.alreadyEnrolled}
                </span>
              ) : null}
            </Field>
          ) : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              control={control}
              name="studentId"
              render={({ field }) => (
                <Field
                  label={strings.personal.studentId}
                  hint={strings.personal.studentIdHint}
                  error={errors.studentId?.message}
                >
                  <Input
                    {...field}
                    readOnly={mode === "existing"}
                    aria-invalid={!!errors.studentId}
                  />
                </Field>
              )}
            />
            <div className="hidden sm:block" />
            <Controller
              control={control}
              name="lastName"
              render={({ field }) => (
                <Field
                  label={strings.personal.lastName}
                  error={errors.lastName?.message}
                >
                  <Input {...field} aria-invalid={!!errors.lastName} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="firstName"
              render={({ field }) => (
                <Field
                  label={strings.personal.firstName}
                  error={errors.firstName?.message}
                >
                  <Input {...field} aria-invalid={!!errors.firstName} />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="parentEmail"
              render={({ field }) => (
                <Field
                  label={strings.personal.parentEmail}
                  hint={strings.personal.optional}
                >
                  <Input {...field} type="email" />
                </Field>
              )}
            />
            <Controller
              control={control}
              name="parentPhone"
              render={({ field }) => (
                <Field
                  label={strings.personal.parentPhone}
                  hint={strings.personal.optional}
                >
                  <Input {...field} />
                </Field>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2 — Contract & tuition */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{strings.contract.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {strings.contract.description}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Class */}
            <Controller
              control={control}
              name="gradeId"
              render={({ field }) => (
                <Field label={strings.contract.class} error={errors.gradeId?.message}>
                  <Select
                    items={Object.fromEntries(
                      context.classes.map((c) => [String(c.gradeId), c.name]),
                    )}
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => changeClass(v ? Number(v) : 0)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue
                        placeholder={strings.contract.classPlaceholder}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {context.classes.map((c) => (
                        <SelectItem key={c.gradeId} value={String(c.gradeId)}>
                          {c.name} · {c.gradeLevelCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Student status / category */}
            <Controller
              control={control}
              name="studentCategory"
              render={({ field }) => (
                <Field label={strings.contract.category}>
                  <Select
                    items={{
                      new: strings.contract.categoryNew,
                      old: strings.contract.categoryOld,
                    }}
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange((v as "new" | "old") ?? "old")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">
                        {strings.contract.categoryNew}
                      </SelectItem>
                      <SelectItem value="old">
                        {strings.contract.categoryOld}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            {/* Tuition contract id */}
            <Controller
              control={control}
              name="tuitionContractId"
              render={({ field }) => (
                <Field
                  label={strings.contract.contractId}
                  hint={strings.contract.contractIdHint}
                >
                  <Input {...field} />
                </Field>
              )}
            />

            {/* Student code */}
            <Controller
              control={control}
              name="studentCode"
              render={({ field }) => (
                <Field
                  label={strings.contract.studentCode}
                  hint={strings.contract.studentCodeHint}
                >
                  <Input {...field} />
                </Field>
              )}
            />

            {/* Base tuition */}
            <Controller
              control={control}
              name="tuitionAmount"
              render={({ field }) => (
                <Field
                  label={strings.contract.baseTuition}
                  hint={strings.contract.baseTuitionHint}
                  error={errors.tuitionAmount?.message}
                >
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={field.value === 0 ? "" : field.value}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                  />
                </Field>
              )}
            />

            {/* Registration (new students only) */}
            {category === "new" ? (
              <Controller
                control={control}
                name="registrationAmount"
                render={({ field }) => (
                  <Field
                    label={strings.contract.registration}
                    hint={strings.contract.registrationHint}
                  >
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={field.value === 0 ? "" : field.value}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === "" ? 0 : Number(e.target.value),
                        )
                      }
                    />
                  </Field>
                )}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* Discounts */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{strings.discounts.title}</CardTitle>
          <span className="text-sm text-muted-foreground">
            {strings.discounts.description}
          </span>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {context.discountTypes.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {strings.discounts.noCatalog}
            </span>
          ) : null}
          {fields.length === 0 && context.discountTypes.length > 0 ? (
            <span className="text-sm text-muted-foreground">
              {strings.discounts.empty}
            </span>
          ) : null}
          {fields.map((row, index) => {
            const rowTypeId = discounts[index]?.discountTypeId;
            const rowType = rowTypeId ? typeById.get(rowTypeId) : undefined;
            const isCustom = !!rowType && rowType.value === null;
            const showSibling = isSiblingDiscount(rowType?.name ?? "");
            const reduction = preview.amountByRow.get(index);
            return (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border p-2">
                <div className="flex items-start gap-1.5">
                  <div className="flex flex-col">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={strings.discounts.moveUp}
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUpIcon />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={strings.discounts.moveDown}
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDownIcon />
                    </Button>
                  </div>
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,1fr)_9rem]">
                    <Controller
                      control={control}
                      name={`discounts.${index}.discountTypeId`}
                      render={({ field }) => (
                        <Select
                          items={Object.fromEntries(
                            context.discountTypes.map((d) => [String(d.id), d.name]),
                          )}
                          value={field.value ? String(field.value) : ""}
                          onValueChange={(v) => field.onChange(v ? Number(v) : 0)}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-invalid={!!errors.discounts?.[index]?.discountTypeId}
                          >
                            <SelectValue placeholder={strings.discounts.choose} />
                          </SelectTrigger>
                          <SelectContent>
                            {context.discountTypes.map((d) => (
                              <SelectItem key={d.id} value={String(d.id)}>
                                {d.name}
                                {d.value !== null
                                  ? ` · ${strings.discounts.expressed(d.unit, d.value)}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {isCustom ? (
                      <Controller
                        control={control}
                        name={`discounts.${index}.value`}
                        render={({ field }) => (
                          <Input
                            type="number"
                            min={0}
                            step={rowType!.unit === "percent" ? 0.5 : 1000}
                            value={
                              field.value === null || field.value === undefined
                                ? ""
                                : field.value
                            }
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === "" ? null : Number(e.target.value),
                              )
                            }
                            placeholder={
                              rowType!.unit === "percent"
                                ? strings.discounts.customValuePercent
                                : strings.discounts.customValueMnt
                            }
                            className="text-right tabular-nums"
                          />
                        )}
                      />
                    ) : (
                      <span className="flex items-center justify-end text-xs text-muted-foreground tabular-nums">
                        {reduction !== undefined ? `−${money(reduction)}` : ""}
                      </span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={strings.discounts.remove}
                  >
                    <XIcon />
                  </Button>
                </div>
                {isCustom && reduction !== undefined ? (
                  <span className="pl-9 text-xs text-muted-foreground tabular-nums">
                    −{money(reduction)}
                  </span>
                ) : null}
                {showSibling ? (
                  <Controller
                    control={control}
                    name={`discounts.${index}.siblingStudentId`}
                    render={({ field }) => {
                      const selected =
                        siblingOptions.find((s) => s.id === field.value) ?? null;
                      return (
                        <Field
                          label={strings.discounts.sibling}
                          hint={strings.discounts.siblingHint}
                        >
                          <Combobox
                            items={siblingOptions}
                            value={selected}
                            onValueChange={(s) =>
                              field.onChange(
                                (s as ExistingStudentOption | null)?.id ?? null,
                              )
                            }
                            itemToStringLabel={(s: ExistingStudentOption) =>
                              `${s.lastName} ${s.firstName} ${s.studentId}`
                            }
                          >
                            <ComboboxTrigger>
                              <ComboboxValue>
                                {selected
                                  ? `${selected.lastName} ${selected.firstName}`
                                  : strings.discounts.siblingPlaceholder}
                              </ComboboxValue>
                            </ComboboxTrigger>
                            <ComboboxContent>
                              <ComboboxInputGroup>
                                <ComboboxInput
                                  placeholder={strings.discounts.siblingSearch}
                                />
                              </ComboboxInputGroup>
                              <ComboboxList>
                                {(item: ExistingStudentOption) => (
                                  <ComboboxItem key={item.id} value={item}>
                                    <span className="flex flex-col">
                                      <span>
                                        {item.lastName} {item.firstName}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {item.studentId}
                                        {item.enrolledThisYear
                                          ? ` · ${strings.mode.existing}`
                                          : ""}
                                      </span>
                                    </span>
                                  </ComboboxItem>
                                )}
                              </ComboboxList>
                              <ComboboxEmpty>
                                {strings.discounts.siblingNoMatch}
                              </ComboboxEmpty>
                            </ComboboxContent>
                          </Combobox>
                        </Field>
                      );
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-icon="inline-start"
              disabled={context.discountTypes.length === 0}
              onClick={() =>
                append({
                  discountTypeId: 0,
                  value: null,
                  notes: "",
                  siblingStudentId: null,
                })
              }
            >
              <PlusIcon />
              {strings.discounts.add}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary + actions */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {strings.summary.baseTuition}
              </span>
              <span>{money(Number(tuitionAmount) || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {strings.summary.discountTotal}
              </span>
              <span>−{money(discountTotal)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>{strings.summary.netTuition}</span>
              <span>{money(netTuition)}</span>
            </div>
            {registrationApplied > 0 ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {strings.summary.registration}
                </span>
                <span>{money(registrationApplied)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-1.5 text-base font-semibold">
              <span>{strings.summary.grandTotal}</span>
              <span>{money(grandTotal)}</span>
            </div>
          </div>

          {serverError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}

          <div className={cn("flex items-center justify-end gap-2")}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push("/students")}
              disabled={submitting}
            >
              {strings.actions.cancel}
            </Button>
            <Button type="submit" disabled={submitting || blockedExisting}>
              {submitting ? strings.actions.submitting : strings.actions.submit}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
