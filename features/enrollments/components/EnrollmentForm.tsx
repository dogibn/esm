"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { PlusIcon, XIcon } from "lucide-react";

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
  const { fields, append, remove } = useFieldArray({ control, name: "discounts" });
  const errors = form.formState.errors;

  const mode = watch("mode");
  const category = watch("studentCategory");
  const tuitionAmount = watch("tuitionAmount");
  const registrationAmount = watch("registrationAmount");
  const discounts = watch("discounts");

  const discountTotal = useMemo(
    () => discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [discounts],
  );
  const netTuition = Math.max(0, (Number(tuitionAmount) || 0) - discountTotal);
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

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
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
          {fields.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              {strings.discounts.empty}
            </span>
          ) : null}
          {fields.map((row, index) => (
            <div
              key={row.id}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(10rem,1fr)_10rem_auto]"
            >
              <Controller
                control={control}
                name={`discounts.${index}.name`}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder={strings.discounts.namePlaceholder}
                    aria-invalid={!!errors.discounts?.[index]?.name}
                  />
                )}
              />
              <Controller
                control={control}
                name={`discounts.${index}.amount`}
                render={({ field }) => (
                  <Input
                    type="number"
                    min={1}
                    step={1000}
                    value={field.value === 0 ? "" : field.value}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value === "" ? 0 : Number(e.target.value),
                      )
                    }
                    placeholder={strings.discounts.amount}
                    aria-invalid={!!errors.discounts?.[index]?.amount}
                  />
                )}
              />
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
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-icon="inline-start"
              onClick={() => append({ name: "", amount: 0, notes: "" })}
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
