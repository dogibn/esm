"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import type { StudentDetailHeader } from "../../detail";
import { strings } from "../../strings";

import { SectionHeading } from "./SectionHeading";

const s = strings.detail.personal;

function Field({ label, value }: { label: string; value: string | null }) {
  const hasValue = value !== null && value.trim().length > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm break-words">{hasValue ? value : s.empty}</dd>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <Input
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

type FormState = {
  firstName: string;
  lastName: string;
  parentEmail: string;
  parentPhone: string;
};

function formFrom(header: StudentDetailHeader): FormState {
  return {
    firstName: header.firstName,
    lastName: header.lastName,
    parentEmail: header.parentEmail ?? "",
    parentPhone: header.parentPhone ?? "",
  };
}

export function PersonalInfoCard({ header }: { header: StudentDetailHeader }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => formFrom(header));

  const startEdit = () => {
    setForm(formFrom(header));
    setError(null);
    setEditing(true);
  };

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${header.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      toast({ message: strings.toasts.profileSaved, variant: "success" });
      // Re-fetch the server component so the banner, this card, and the
      // tracking table all reflect the saved values.
      router.refresh();
    } catch (err) {
      setError((err as Error).message || s.saveError);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Card size="sm">
        <CardHeader>
          <SectionHeading title={s.title} />
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <LabeledInput
              label={s.firstName}
              value={form.firstName}
              onChange={(v) => set({ firstName: v })}
              required
              autoComplete="off"
            />
            <LabeledInput
              label={s.lastName}
              value={form.lastName}
              onChange={(v) => set({ lastName: v })}
              required
              autoComplete="off"
            />
            <LabeledInput
              label={s.parentEmail}
              type="email"
              value={form.parentEmail}
              onChange={(v) => set({ parentEmail: v })}
              autoComplete="off"
            />
            <LabeledInput
              label={s.parentPhone}
              type="tel"
              value={form.parentPhone}
              onChange={(v) => set({ parentPhone: v })}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">{s.readonlyHint}</p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? s.saving : s.save}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={() => setEditing(false)}
              >
                {s.cancel}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader>
        <SectionHeading
          title={s.title}
          action={
            <Button variant="ghost" size="sm" onClick={startEdit}>
              <Pencil />
              {s.edit}
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          {strings.detail.studentId(header.code)}
        </p>
        <dl className="flex flex-col gap-3">
          <Field label={s.class} value={header.gradeName} />
          <Field label={s.teacher} value={header.teacherName} />
          <Field label={s.parentEmail} value={header.parentEmail} />
          <Field label={s.parentPhone} value={header.parentPhone} />
          <Field label={s.contract} value={header.tuitionContractId} />
        </dl>
      </CardContent>
    </Card>
  );
}
