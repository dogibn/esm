"use client";

import { useState } from "react";

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

import type { UserRole } from "../schemas";
import { strings } from "../strings";

const f = strings.form;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: (email: string) => void;
};

export function AddUserDialog({ open, onOpenChange, onAdded }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Remount per open so the fields start empty every time. */}
        <AddUserForm key={String(open)} onOpenChange={onOpenChange} onAdded={onAdded} />
      </DialogContent>
    </Dialog>
  );
}

function AddUserForm({ onOpenChange, onAdded }: Omit<Props, "open">) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("accountant");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `HTTP ${res.status}`);
      }
      onOpenChange(false);
      onAdded(email.trim().toLowerCase());
    } catch (err) {
      setError((err as Error).message || f.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{f.title}</DialogTitle>
      </DialogHeader>

      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {f.email}
          </span>
          <Input
            type="email"
            value={email}
            required
            autoComplete="off"
            placeholder={f.emailPlaceholder}
            onChange={(e) => setEmail(e.target.value)}
          />
          <span className="text-xs text-muted-foreground">{f.emailHint}</span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {f.role}
          </span>
          <Select
            items={strings.roles}
            value={role}
            onValueChange={(v) => setRole((v as UserRole) ?? "accountant")}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accountant">{strings.roles.accountant}</SelectItem>
              <SelectItem value="admin">{strings.roles.admin}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">{strings.roleHint[role]}</span>
        </label>

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
