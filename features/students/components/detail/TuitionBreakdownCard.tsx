"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import type { TuitionBreakdown } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";

import { SectionHeading } from "./SectionHeading";

const s = strings.detail.tuition;

type DiscountDraft = { name: string; amount: string };

function toAmount(v: string): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function TuitionBreakdownCard({
  studentId,
  tuition,
}: {
  studentId: number;
  tuition: TuitionBreakdown | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState("0");
  const [rows, setRows] = useState<DiscountDraft[]>([]);

  const startEdit = () => {
    if (!tuition) return;
    setBase(String(tuition.gross));
    setRows(tuition.discounts.map((d) => ({ name: d.name, amount: String(d.amount) })));
    setError(null);
    setEditing(true);
  };

  const baseNum = toAmount(base);
  const discountTotal = rows.reduce((sum, r) => sum + toAmount(r.amount), 0);
  const netPreview = baseNum - discountTotal;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/students/${studentId}/tuition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseAmount: baseNum,
          discounts: rows
            .filter((r) => r.name.trim().length > 0)
            .map((r) => ({ name: r.name.trim(), amount: toAmount(r.amount) })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setEditing(false);
      toast({ message: strings.toasts.tuitionSaved, variant: "success" });
      router.refresh();
    } catch (err) {
      setError((err as Error).message || s.saveError);
    } finally {
      setSaving(false);
    }
  };

  // ── Edit mode ──────────────────────────────────────────────────────────────
  if (editing && tuition) {
    return (
      <Card size="sm">
        <CardHeader>
          <SectionHeading title={s.title} />
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
            <label className="flex items-center justify-between gap-2">
              <span>{s.base}</span>
              <Input
                type="number"
                min={0}
                value={base}
                onChange={(e) => setBase(e.target.value)}
                className="w-40 text-right tabular-nums"
              />
            </label>

            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    placeholder={s.discountNamePlaceholder}
                    aria-label={s.discountName}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)),
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={row.amount}
                    onChange={(e) =>
                      setRows((rs) =>
                        rs.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)),
                      )
                    }
                    className="w-28 text-right tabular-nums"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={s.removeDiscount}
                    onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => setRows((rs) => [...rs, { name: "", amount: "0" }])}
              >
                <Plus />
                {s.addDiscount}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{s.net}</span>
              <span className="font-semibold tabular-nums">{formatMnt(netPreview)}</span>
            </div>

            {tuition.paid > 0 ? (
              <p className="text-xs text-muted-foreground">
                {s.paidHint(formatMnt(tuition.paid))}
              </p>
            ) : null}
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

  // ── Read mode ──────────────────────────────────────────────────────────────
  return (
    <Card size="sm">
      <CardHeader>
        <SectionHeading
          title={s.title}
          action={
            tuition ? (
              <Button variant="ghost" size="sm" onClick={startEdit}>
                <Pencil />
                {s.edit}
              </Button>
            ) : undefined
          }
        />
      </CardHeader>
      <CardContent>
        {tuition === null ? (
          <p className="text-sm text-muted-foreground">{s.noCharge}</p>
        ) : (
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span>{s.base}</span>
              <span className="font-medium tabular-nums">
                {formatMnt(tuition.gross)}
              </span>
            </div>
            {tuition.discounts.map((d, i) => (
              <div
                key={`${d.name}-${i}`}
                className="flex items-center justify-between gap-2 text-muted-foreground"
              >
                <span className="break-words">{d.name}</span>
                <span className="tabular-nums">−{formatMnt(d.amount)}</span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{s.net}</span>
              <span className="font-semibold tabular-nums">
                {formatMnt(tuition.net)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
