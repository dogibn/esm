"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import { strings } from "../strings";
import type { ClassRow, GradeLevelRow } from "../types";

import { Field } from "./Field";

const f = strings.form;

type Props = {
  open: boolean;
  /** null → add mode. */
  target: ClassRow | null;
  levels: GradeLevelRow[];
  yearId: number;
  yearName: string;
  onOpenChange: (open: boolean) => void;
};

export function ClassDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <ClassForm key={`${props.open}:${props.target?.id ?? "add"}`} {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ClassForm({
  target,
  levels,
  yearId,
  yearName,
  onOpenChange,
}: Omit<Props, "open">) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = target !== null;
  // The level sets the tuition rate, so it stops being editable once anyone is
  // enrolled (the server enforces this too).
  const levelLocked = isEdit && !target.canChangeLevel;

  const [name, setName] = useState(target?.name ?? "");
  const [gradeLevelId, setGradeLevelId] = useState(
    String(target?.gradeLevelId ?? levels[0]?.id ?? ""),
  );
  const [teacherName, setTeacherName] = useState(target?.teacherName ?? "");
  const [teacherEmail, setTeacherEmail] = useState(target?.teacherEmail ?? "");
  const [teacherPhone, setTeacherPhone] = useState(target?.teacherPhone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const levelItems = Object.fromEntries(levels.map((l) => [String(l.id), l.code]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/classes/${target.id}` : "/api/classes", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          gradeLevelId: Number(gradeLevelId),
          teacherName: teacherName.trim(),
          teacherEmail,
          teacherPhone,
          // Only a new class needs its year; a class keeps the one it has.
          ...(isEdit ? {} : { academicYearId: yearId }),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      toast({
        message: isEdit ? strings.toasts.classUpdated : strings.toasts.classCreated,
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
        <DialogTitle>{isEdit ? f.editClassTitle : f.addClassTitle}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <p className="text-sm text-muted-foreground">{f.inYear(yearName)}</p>

        <div className="flex gap-2">
          <Field label={f.className}>
            <Input
              value={name}
              required
              maxLength={50}
              placeholder={f.classNamePlaceholder}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label={f.level}>
            <Select
              items={levelItems}
              value={gradeLevelId}
              disabled={levelLocked}
              onValueChange={(v) => setGradeLevelId(String(v ?? gradeLevelId))}
            >
              <SelectTrigger size="sm" disabled={levelLocked}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {levels.map((l) => (
                  <SelectItem key={l.id} value={String(l.id)}>
                    {l.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <span className="text-xs text-muted-foreground">
          {levelLocked ? f.levelLockedHint : f.classNameHint}
        </span>

        <Field label={f.teacherName}>
          <Input
            value={teacherName}
            required
            maxLength={120}
            placeholder={f.teacherNamePlaceholder}
            onChange={(e) => setTeacherName(e.target.value)}
          />
        </Field>

        <div className="flex gap-2">
          <Field label={f.teacherEmail}>
            <Input
              type="email"
              value={teacherEmail}
              maxLength={255}
              onChange={(e) => setTeacherEmail(e.target.value)}
            />
          </Field>
          <Field label={f.teacherPhone}>
            <Input
              value={teacherPhone}
              maxLength={50}
              onChange={(e) => setTeacherPhone(e.target.value)}
            />
          </Field>
        </div>

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
