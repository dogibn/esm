"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

import { strings } from "../strings";
import type { ClassRow, ClassesOverview, GradeLevelRow } from "../types";

import { ClassDialog } from "./ClassDialog";
import { GradeLevelDialog } from "./GradeLevelDialog";

const s = strings;

type ConfirmState =
  | { open: false }
  | { open: true; kind: "level" | "class"; id: number; name: string };

export function ClassesView({
  overview,
  canEdit,
}: {
  overview: ClassesOverview;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [levelDialog, setLevelDialog] = useState<{
    open: boolean;
    target: GradeLevelRow | null;
  }>({ open: false, target: null });
  const [classDialog, setClassDialog] = useState<{
    open: boolean;
    target: ClassRow | null;
  }>({ open: false, target: null });
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  const year = overview.years.find((y) => y.id === overview.selectedYearId);
  const yearName = year?.name ?? "";

  const runDelete = async () => {
    if (!confirm.open) return;
    const url =
      confirm.kind === "level"
        ? `/api/classes/levels/${confirm.id}`
        : `/api/classes/${confirm.id}`;
    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(b?.error ?? `HTTP ${res.status}`);
    }
    toast({
      message:
        confirm.kind === "level" ? s.toasts.levelDeleted : s.toasts.classDeleted,
      variant: "success",
    });
    router.refresh();
  };

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={canEdit ? s.page.description : s.page.adminHint}
      />

      <Card size="sm">
        <CardHeader className="border-b pb-3">
          <CardTitle>{s.levels.title}</CardTitle>
          <CardDescription>{s.levels.description}</CardDescription>
          {canEdit ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLevelDialog({ open: true, target: null })}
              >
                <Plus />
                {s.levels.add}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {overview.levels.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{s.levels.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.levels.columns.code}</TableHead>
                  <TableHead>{s.levels.columns.order}</TableHead>
                  <TableHead>{s.levels.columns.tuition}</TableHead>
                  <TableHead>{s.levels.columns.usage}</TableHead>
                  {canEdit ? <TableHead className="w-0" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.levels.map((level) => (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.code}</TableCell>
                    <TableCell className="tabular-nums">{level.sortOrder}</TableCell>
                    <TableCell>
                      <Badge variant={level.usedInTuition ? "info" : "outline"}>
                        {level.usedInTuition ? s.levels.priced : s.levels.notPriced}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.levels.usage(level.usage) || s.levels.unused}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLevelDialog({ open: true, target: level })}
                          aria-label={s.actions.editLevel(level.code)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!level.canDelete}
                          title={level.canDelete ? undefined : s.remove.blockedHint}
                          onClick={() =>
                            setConfirm({
                              open: true,
                              kind: "level",
                              id: level.id,
                              name: level.code,
                            })
                          }
                          aria-label={s.actions.deleteLevel(level.code)}
                        >
                          <Trash2 />
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

      <Card size="sm">
        <CardHeader className="border-b pb-3">
          <CardTitle>{s.classes.title(yearName)}</CardTitle>
          <CardDescription>{s.classes.description}</CardDescription>
          <CardAction className="flex items-center gap-2">
            <Select
              items={Object.fromEntries(
                overview.years.map((y) => [String(y.id), y.name]),
              )}
              value={String(overview.selectedYearId)}
              onValueChange={(v) => router.push(`/classes?year=${String(v)}`)}
            >
              <SelectTrigger size="sm" aria-label={s.yearPicker.label}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {overview.years.map((y) => (
                  <SelectItem key={y.id} value={String(y.id)}>
                    {y.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit ? (
              <Button
                variant="outline"
                size="sm"
                disabled={overview.levels.length === 0}
                onClick={() => setClassDialog({ open: true, target: null })}
              >
                <Plus />
                {s.classes.add}
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {overview.classes.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{s.classes.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.classes.columns.name}</TableHead>
                  <TableHead>{s.classes.columns.level}</TableHead>
                  <TableHead>{s.classes.columns.teacher}</TableHead>
                  <TableHead>{s.classes.columns.contact}</TableHead>
                  <TableHead>{s.classes.columns.students}</TableHead>
                  {canEdit ? <TableHead className="w-0" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.classes.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.name}</TableCell>
                    <TableCell>{cls.gradeLevelCode}</TableCell>
                    <TableCell>
                      {cls.teacherName || (
                        <span className="text-muted-foreground">
                          {s.classes.noTeacher}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex flex-col">
                        <span>{cls.teacherEmail ?? s.classes.noTeacher}</span>
                        {cls.teacherPhone ? (
                          <span className="text-xs">{cls.teacherPhone}</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{cls.enrollments}</TableCell>
                    {canEdit ? (
                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setClassDialog({ open: true, target: cls })}
                          aria-label={s.actions.editClass(cls.name)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!cls.canDelete}
                          title={cls.canDelete ? undefined : s.remove.blockedHint}
                          onClick={() =>
                            setConfirm({
                              open: true,
                              kind: "class",
                              id: cls.id,
                              name: cls.name,
                            })
                          }
                          aria-label={s.actions.deleteClass(cls.name)}
                        >
                          <Trash2 />
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
        <>
          <GradeLevelDialog
            open={levelDialog.open}
            target={levelDialog.target}
            onOpenChange={(open) => setLevelDialog((d) => ({ ...d, open }))}
          />
          <ClassDialog
            open={classDialog.open}
            target={classDialog.target}
            levels={overview.levels}
            yearId={overview.selectedYearId}
            yearName={yearName}
            onOpenChange={(open) => setClassDialog((d) => ({ ...d, open }))}
          />
          <ConfirmDialog
            open={confirm.open}
            title={
              confirm.open && confirm.kind === "level"
                ? s.remove.levelTitle
                : s.remove.classTitle
            }
            body={confirm.open ? s.remove.body(confirm.name) : ""}
            destructive
            confirmLabel={s.remove.confirm}
            busyLabel={s.remove.deleting}
            cancelLabel={s.remove.cancel}
            errorLabel={s.remove.error}
            onOpenChange={(open) => {
              if (!open) setConfirm({ open: false });
            }}
            onConfirm={runDelete}
          />
        </>
      ) : null}
    </PageContainer>
  );
}
