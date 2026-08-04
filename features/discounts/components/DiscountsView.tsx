"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { DiscountTypeRow } from "../api";
import { strings } from "../strings";

import { DiscountTypeDialog } from "./DiscountTypeDialog";

const s = strings;

export function DiscountsView({
  types,
  canEdit,
}: {
  types: DiscountTypeRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{
    open: boolean;
    target: DiscountTypeRow | null;
  }>({ open: false, target: null });

  const openAdd = () => setDialog({ open: true, target: null });
  const openEdit = (target: DiscountTypeRow) => setDialog({ open: true, target });

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={canEdit ? s.page.description : s.page.adminHint}
        actions={
          canEdit ? (
            <Button size="sm" onClick={openAdd}>
              <Plus />
              {s.add}
            </Button>
          ) : undefined
        }
      />

      <Card size="sm">
        <CardContent className="p-0">
          {types.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">{s.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.name}</TableHead>
                  <TableHead>{s.columns.unit}</TableHead>
                  <TableHead>{s.columns.value}</TableHead>
                  <TableHead>{s.columns.note}</TableHead>
                  <TableHead>{s.columns.status}</TableHead>
                  {canEdit ? <TableHead className="w-0" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((t) => (
                  <TableRow key={t.id} className={t.isActive ? "" : "opacity-60"}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{s.unit[t.unit]}</TableCell>
                    <TableCell className="tabular-nums">
                      {t.value === null ? (
                        <span className="text-muted-foreground">{s.custom}</span>
                      ) : (
                        s.valueLabel(t.unit, t.value)
                      )}
                    </TableCell>
                    <TableCell className="max-w-[24ch] truncate text-muted-foreground">
                      {t.note ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "default" : "secondary"}>
                        {t.isActive ? s.active : s.inactive}
                      </Badge>
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(t)}
                          aria-label={`${s.edit} ${t.name}`}
                        >
                          <Pencil />
                          {s.edit}
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canEdit ? (
        <DiscountTypeDialog
          open={dialog.open}
          target={dialog.target}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </PageContainer>
  );
}
