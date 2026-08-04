"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/toast";
// Pure calc imported from its module (not the barrel) so this client component
// never pulls server-only code (db) into the bundle.
import { computeTuition } from "@/features/discounts/calc";
import type { DiscountTypeRow } from "@/features/discounts";

import type { SiblingOption, TuitionBreakdown } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";

import { SectionHeading } from "./SectionHeading";

const s = strings.detail.tuition;

// A discount a sibling can be linked on is recognised by name (no type flag in
// v1) — same heuristic the enrollment form uses.
function isSiblingDiscount(name: string): boolean {
  return /sibling/i.test(name);
}

type DiscountDraft = {
  key: string;
  // Catalog entry id, or null for a legacy/manual row (pre-catalog).
  discountTypeId: number | null;
  isLegacy: boolean;
  customValue: string;
  siblingStudentId: number | null;
  // Snapshot carried for legacy rows so they survive a save unchanged.
  legacyName?: string;
  legacyUnit?: "mnt" | "percent";
  legacyValue?: number;
};

let keySeq = 0;
const nextKey = () => `d${keySeq++}`;

function toIntOrZero(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function TuitionBreakdownCard({
  studentId,
  tuition,
  siblingCandidates,
  discountTypes,
}: {
  studentId: number;
  tuition: TuitionBreakdown | null;
  siblingCandidates: SiblingOption[];
  discountTypes: DiscountTypeRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState("0");
  const [rows, setRows] = useState<DiscountDraft[]>([]);

  const typeById = useMemo(
    () => new Map(discountTypes.map((t) => [t.id, t])),
    [discountTypes],
  );

  const startEdit = () => {
    if (!tuition) return;
    setBase(String(tuition.gross));
    setRows(
      tuition.discounts.map((d) => ({
        key: nextKey(),
        discountTypeId: d.discountTypeId,
        isLegacy: d.discountTypeId === null,
        customValue: String(d.value),
        siblingStudentId: d.siblingStudentId,
        legacyName: d.discountTypeId === null ? d.name : undefined,
        legacyUnit: d.discountTypeId === null ? d.unit : undefined,
        legacyValue: d.discountTypeId === null ? d.value : undefined,
      })),
    );
    setError(null);
    setEditing(true);
  };

  const baseNum = toIntOrZero(base);

  // Resolve a draft to how it will be applied, or null if incomplete.
  const resolveDraft = (
    d: DiscountDraft,
  ): { name: string; unit: "mnt" | "percent"; value: number } | null => {
    if (d.isLegacy) {
      return { name: d.legacyName ?? "", unit: d.legacyUnit ?? "mnt", value: d.legacyValue ?? 0 };
    }
    if (d.discountTypeId === null) return null;
    const t = typeById.get(d.discountTypeId);
    if (!t) return null;
    const value = t.value !== null ? t.value : toIntOrZero(d.customValue);
    if (t.value === null && d.customValue.trim() === "") return null;
    return { name: t.name, unit: t.unit, value };
  };

  // Live compounding preview: reductions align to the resolvable rows, in order.
  const preview = useMemo(() => {
    const resolvedByRow = rows.map(resolveDraft);
    const applied = resolvedByRow
      .map((r, i) => (r ? { i, unit: r.unit, value: r.value } : null))
      .filter((x): x is { i: number; unit: "mnt" | "percent"; value: number } => x !== null);
    const comp = computeTuition(baseNum, applied.map((a) => ({ unit: a.unit, value: a.value })));
    const amountByRow = new Map<number, number>();
    applied.forEach((a, idx) => amountByRow.set(a.i, comp.lines[idx]!.amount));
    return { net: comp.net, discountTotal: comp.discountTotal, amountByRow };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, baseNum, typeById]);

  const move = (i: number, dir: -1 | 1) => {
    setRows((rs) => {
      const j = i + dir;
      if (j < 0 || j >= rs.length) return rs;
      const copy = [...rs];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = rows
        .map((d) => {
          if (d.isLegacy) {
            return {
              discountTypeId: null,
              name: d.legacyName,
              unit: d.legacyUnit,
              value: d.legacyValue,
              siblingStudentId: d.siblingStudentId,
            };
          }
          if (d.discountTypeId === null) return null; // unselected row → drop
          const t = typeById.get(d.discountTypeId);
          const custom = t && t.value === null;
          return {
            discountTypeId: d.discountTypeId,
            value: custom ? toIntOrZero(d.customValue) : null,
            siblingStudentId: isSiblingDiscount(t?.name ?? "")
              ? d.siblingStudentId
              : null,
          };
        })
        .filter((x) => x !== null);

      const res = await fetch(`/api/students/${studentId}/tuition`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ baseAmount: baseNum, discounts: payload }),
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
              {rows.map((row, i) => {
                const t = row.discountTypeId !== null ? typeById.get(row.discountTypeId) : undefined;
                const isCustom = !row.isLegacy && !!t && t.value === null;
                const rowName = row.isLegacy ? (row.legacyName ?? "") : (t?.name ?? "");
                const showSibling = isSiblingDiscount(rowName);
                const selectedSibling =
                  siblingCandidates.find((c) => c.id === row.siblingStudentId) ?? null;
                const reduction = preview.amountByRow.get(i);
                return (
                  <div key={row.key} className="flex flex-col gap-1.5 rounded-lg border p-2">
                    <div className="flex items-center gap-1.5">
                      <div className="flex flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={s.moveUp}
                          disabled={i === 0}
                          onClick={() => move(i, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={s.moveDown}
                          disabled={i === rows.length - 1}
                          onClick={() => move(i, 1)}
                        >
                          <ArrowDown />
                        </Button>
                      </div>

                      <div className="flex flex-1 flex-col gap-1">
                        {row.isLegacy ? (
                          <span className="flex items-center gap-2">
                            <span className="font-medium">{row.legacyName}</span>
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {s.legacyTag} · {s.expressed(row.legacyUnit ?? "mnt", row.legacyValue ?? 0)}
                            </span>
                          </span>
                        ) : (
                          <Select
                            items={Object.fromEntries(discountTypes.map((d) => [String(d.id), d.name]))}
                            value={row.discountTypeId === null ? "" : String(row.discountTypeId)}
                            onValueChange={(v) =>
                              setRows((rs) =>
                                rs.map((r, j) =>
                                  j === i ? { ...r, discountTypeId: v ? Number(v) : null } : r,
                                ),
                              )
                            }
                          >
                            <SelectTrigger size="sm" className="w-full">
                              <SelectValue placeholder={s.chooseDiscount} />
                            </SelectTrigger>
                            <SelectContent>
                              {discountTypes.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.name}
                                  {d.value !== null
                                    ? ` · ${s.expressed(d.unit, d.value)}`
                                    : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {isCustom ? (
                        <Input
                          type="number"
                          min={0}
                          value={row.customValue}
                          placeholder={t!.unit === "percent" ? s.customValuePercent : s.customValueMnt}
                          onChange={(e) =>
                            setRows((rs) =>
                              rs.map((r, j) => (j === i ? { ...r, customValue: e.target.value } : r)),
                            )
                          }
                          className="w-24 text-right tabular-nums"
                        />
                      ) : null}

                      <span className="w-24 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                        {reduction !== undefined ? `−${formatMnt(reduction)}` : "—"}
                      </span>

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

                    {showSibling ? (
                      <Combobox
                        items={siblingCandidates}
                        value={selectedSibling}
                        onValueChange={(c) =>
                          setRows((rs) =>
                            rs.map((r, j) =>
                              j === i
                                ? { ...r, siblingStudentId: (c as SiblingOption | null)?.id ?? null }
                                : r,
                            ),
                          )
                        }
                        itemToStringLabel={(c: SiblingOption) => `${c.lastName} ${c.firstName} ${c.code}`}
                      >
                        <ComboboxTrigger className="w-full">
                          <ComboboxValue>
                            {selectedSibling
                              ? `${selectedSibling.lastName} ${selectedSibling.firstName}`
                              : s.siblingSelect}
                          </ComboboxValue>
                        </ComboboxTrigger>
                        <ComboboxContent>
                          <ComboboxInputGroup>
                            <ComboboxInput placeholder={s.siblingSearch} />
                          </ComboboxInputGroup>
                          <ComboboxList>
                            {(item: SiblingOption) => (
                              <ComboboxItem key={item.id} value={item}>
                                <span className="flex flex-col">
                                  <span>
                                    {item.lastName} {item.firstName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">{item.code}</span>
                                </span>
                              </ComboboxItem>
                            )}
                          </ComboboxList>
                          <ComboboxEmpty>{s.siblingNoMatch}</ComboboxEmpty>
                        </ComboboxContent>
                      </Combobox>
                    ) : null}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={discountTypes.length === 0}
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    {
                      key: nextKey(),
                      discountTypeId: null,
                      isLegacy: false,
                      customValue: "",
                      siblingStudentId: null,
                    },
                  ])
                }
              >
                <Plus />
                {s.addDiscount}
              </Button>
              <p className="text-xs text-muted-foreground">
                {discountTypes.length === 0 ? s.noCatalog : s.orderHint}
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{s.net}</span>
              <span className="font-semibold tabular-nums">{formatMnt(preview.net)}</span>
            </div>

            {tuition.paid > 0 ? (
              <p className="text-xs text-muted-foreground">{s.paidHint(formatMnt(tuition.paid))}</p>
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
              <span className="font-medium tabular-nums">{formatMnt(tuition.gross)}</span>
            </div>
            {tuition.discounts.map((d, i) => (
              <div key={`${d.name}-${i}`} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="break-words">
                    {d.name}
                    <span className="ml-1 text-xs">· {s.expressed(d.unit, d.value)}</span>
                  </span>
                  <span className="tabular-nums">−{formatMnt(d.amount)}</span>
                </div>
                {d.siblingName ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="break-words">{s.siblingLabel(d.siblingName)}</span>
                    <span
                      className={
                        d.siblingEnrolled
                          ? "rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-400"
                          : "rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-500"
                      }
                    >
                      {d.siblingEnrolled ? s.siblingEnrolled : s.siblingNotEnrolled}
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between gap-2 border-t pt-2">
              <span className="font-semibold">{s.net}</span>
              <span className="font-semibold tabular-nums">{formatMnt(tuition.net)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
