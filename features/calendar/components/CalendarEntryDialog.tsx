"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { strings } from "../strings";

const f = strings.form;

export type CalendarEntryTarget = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

type Props = {
  open: boolean;
  kind: "year" | "term";
  /** null → add mode. */
  target: CalendarEntryTarget | null;
  /** The year a new term is added to; null when editing, or for a year. */
  yearId: number | null;
  /** Shown as context so it's clear which year a term belongs to. */
  yearName: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

// Years and terms carry the same three fields, so they share one form. What
// differs is the endpoint and the wording.
export function CalendarEntryDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {/* Remount per open/target so the fields derive fresh from props. */}
        <CalendarEntryForm
          key={`${props.open}:${props.kind}:${props.target?.id ?? `add-${props.yearId ?? ""}`}`}
          {...props}
        />
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function CalendarEntryForm({
  kind,
  target,
  yearId,
  yearName,
  onOpenChange,
  onSaved,
}: Omit<Props, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = target !== null;
  const isYear = kind === "year";

  const [name, setName] = useState(target?.name ?? "");
  const [startDate, setStartDate] = useState(target?.startDate ?? "");
  const [endDate, setEndDate] = useState(target?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = isYear
    ? isEdit
      ? f.editYearTitle
      : f.addYearTitle
    : isEdit
      ? f.editTermTitle
      : f.addTermTitle;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const base = isYear ? "/api/calendar/years" : "/api/calendar/terms";
      const res = await fetch(isEdit ? `${base}/${target.id}` : base, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          startDate,
          endDate,
          // Only a new term needs its year; an edit keeps the one it has.
          ...(!isYear && !isEdit ? { academicYearId: yearId } : {}),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      onSaved();
      toast({
        message: isYear
          ? isEdit
            ? strings.toasts.yearUpdated
            : strings.toasts.yearCreated
          : isEdit
            ? strings.toasts.termUpdated
            : strings.toasts.termCreated,
        variant: "success",
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message || f.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        {!isYear && yearName ? (
          <p className="text-sm text-muted-foreground">{f.inYear(yearName)}</p>
        ) : null}

        <Field label={isYear ? f.yearName : f.termName}>
          <Input
            value={name}
            required
            maxLength={50}
            placeholder={isYear ? f.yearNamePlaceholder : f.termNamePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Field label={f.startDate}>
            <Input
              type="date"
              value={startDate}
              required
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label={f.endDate}>
            <Input
              type="date"
              value={endDate}
              required
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>

        <span className="text-xs text-muted-foreground">
          {isYear ? f.yearHint : f.termHint}
        </span>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {f.cancel}
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? f.saving : f.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
