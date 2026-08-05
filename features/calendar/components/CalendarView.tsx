"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Pencil, Plus, Trash2 } from "lucide-react";

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
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";

import { pickCurrentTerm } from "../current";
import { strings } from "../strings";
import type { AcademicCalendar, AcademicTermRow, AcademicYearRow } from "../types";

import {
  CalendarEntryDialog,
  type CalendarEntryTarget,
} from "./CalendarEntryDialog";
import { ConfirmDialog } from "./ConfirmDialog";

const s = strings;

type EntryDialogState = {
  open: boolean;
  kind: "year" | "term";
  target: CalendarEntryTarget | null;
  yearId: number | null;
  yearName: string | null;
};

type ConfirmState =
  | { open: false }
  | {
      open: true;
      kind: "setYear" | "setTerm" | "deleteYear" | "deleteTerm";
      id: number;
      name: string;
      /** The term that will come along when a year is made current. */
      termName?: string;
    };

const closedEntry: EntryDialogState = {
  open: false,
  kind: "year",
  target: null,
  yearId: null,
  yearName: null,
};

async function post(url: string, method: "POST" | "DELETE"): Promise<unknown> {
  const res = await fetch(url, { method, credentials: "include" });
  if (!res.ok) {
    const b = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(b?.error ?? `HTTP ${res.status}`);
  }
  return res.json().catch(() => null);
}

export function CalendarView({
  calendar,
  canEdit,
}: {
  calendar: AcademicCalendar;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [entry, setEntry] = useState<EntryDialogState>(closedEntry);
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  const closeConfirm = () => setConfirm({ open: false });

  const runConfirm = async () => {
    if (!confirm.open) return;
    switch (confirm.kind) {
      case "setYear": {
        const result = (await post(
          `/api/calendar/years/${confirm.id}/current`,
          "POST",
        )) as { termName: string } | null;
        toast({
          message: s.toasts.currentYearSet(
            confirm.name,
            result?.termName ?? confirm.termName ?? "",
          ),
          variant: "success",
        });
        break;
      }
      case "setTerm":
        await post(`/api/calendar/terms/${confirm.id}/current`, "POST");
        toast({ message: s.toasts.currentTermSet(confirm.name), variant: "success" });
        break;
      case "deleteYear":
        await post(`/api/calendar/years/${confirm.id}`, "DELETE");
        toast({ message: s.toasts.yearDeleted, variant: "success" });
        break;
      case "deleteTerm":
        await post(`/api/calendar/terms/${confirm.id}`, "DELETE");
        toast({ message: s.toasts.termDeleted, variant: "success" });
        break;
    }
    router.refresh();
  };

  const confirmCopy = () => {
    if (!confirm.open) {
      return { title: "", body: "", note: null as string | null, destructive: false };
    }
    switch (confirm.kind) {
      case "setYear":
        return {
          title: s.setCurrent.yearTitle,
          body: s.setCurrent.yearBody(confirm.name),
          note: confirm.termName ? s.setCurrent.yearTermNote(confirm.termName) : null,
          destructive: false,
        };
      case "setTerm":
        return {
          title: s.setCurrent.termTitle,
          body: s.setCurrent.termBody(confirm.name),
          note: null,
          destructive: false,
        };
      case "deleteYear":
        return {
          title: s.remove.yearTitle,
          body: s.remove.body(confirm.name),
          note: null,
          destructive: true,
        };
      case "deleteTerm":
        return {
          title: s.remove.termTitle,
          body: s.remove.body(confirm.name),
          note: null,
          destructive: true,
        };
    }
  };

  const copy = confirmCopy();
  const isDelete = confirm.open && confirm.kind.startsWith("delete");

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={canEdit ? s.page.description : s.page.adminHint}
        actions={
          canEdit ? (
            <Button
              size="sm"
              onClick={() =>
                setEntry({ ...closedEntry, open: true, kind: "year" })
              }
            >
              <Plus />
              {s.actions.addYear}
            </Button>
          ) : undefined
        }
      />

      {calendar.years.length === 0 ? (
        <Card size="sm">
          <CardContent>
            <p className="py-6 text-sm text-muted-foreground">{s.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {calendar.years.map((year) => (
            <YearCard
              key={year.id}
              year={year}
              canEdit={canEdit}
              onEditYear={() =>
                setEntry({
                  open: true,
                  kind: "year",
                  target: year,
                  yearId: year.id,
                  yearName: year.name,
                })
              }
              onAddTerm={() =>
                setEntry({
                  open: true,
                  kind: "term",
                  target: null,
                  yearId: year.id,
                  yearName: year.name,
                })
              }
              onEditTerm={(term) =>
                setEntry({
                  open: true,
                  kind: "term",
                  target: term,
                  yearId: year.id,
                  yearName: year.name,
                })
              }
              onSetCurrentYear={() =>
                setConfirm({
                  open: true,
                  kind: "setYear",
                  id: year.id,
                  name: year.name,
                  // Same rule the server applies, so the dialog can't promise a
                  // different term than the one that ends up current.
                  termName: pickCurrentTerm(year.terms)?.name,
                })
              }
              onSetCurrentTerm={(term) =>
                setConfirm({
                  open: true,
                  kind: "setTerm",
                  id: term.id,
                  name: term.name,
                })
              }
              onDeleteYear={() =>
                setConfirm({
                  open: true,
                  kind: "deleteYear",
                  id: year.id,
                  name: year.name,
                })
              }
              onDeleteTerm={(term) =>
                setConfirm({
                  open: true,
                  kind: "deleteTerm",
                  id: term.id,
                  name: term.name,
                })
              }
            />
          ))}
        </div>
      )}

      {canEdit ? (
        <>
          <CalendarEntryDialog
            open={entry.open}
            kind={entry.kind}
            target={entry.target}
            yearId={entry.yearId}
            yearName={entry.yearName}
            onOpenChange={(open) => setEntry((e) => ({ ...e, open }))}
            onSaved={() => router.refresh()}
          />
          <ConfirmDialog
            open={confirm.open}
            title={copy.title}
            body={copy.body}
            note={copy.note}
            destructive={copy.destructive}
            confirmLabel={isDelete ? s.remove.confirm : s.setCurrent.confirm}
            busyLabel={isDelete ? s.remove.deleting : s.setCurrent.confirming}
            cancelLabel={isDelete ? s.remove.cancel : s.setCurrent.cancel}
            errorLabel={isDelete ? s.remove.error : s.setCurrent.error}
            onOpenChange={(open) => {
              if (!open) closeConfirm();
            }}
            onConfirm={runConfirm}
          />
        </>
      ) : null}
    </PageContainer>
  );
}

function YearCard({
  year,
  canEdit,
  onEditYear,
  onAddTerm,
  onEditTerm,
  onSetCurrentYear,
  onSetCurrentTerm,
  onDeleteYear,
  onDeleteTerm,
}: {
  year: AcademicYearRow;
  canEdit: boolean;
  onEditYear: () => void;
  onAddTerm: () => void;
  onEditTerm: (term: AcademicTermRow) => void;
  onSetCurrentYear: () => void;
  onSetCurrentTerm: (term: AcademicTermRow) => void;
  onDeleteYear: () => void;
  onDeleteTerm: (term: AcademicTermRow) => void;
}) {
  const currentTerm = year.terms.find((t) => t.isCurrent);
  const usage = s.usage.year(year.usage);

  return (
    <Card size="sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2">
          {year.name}
          {year.isCurrent ? <Badge variant="success">{s.current}</Badge> : null}
        </CardTitle>
        <CardDescription>
          {s.dateRange(year.startDate, year.endDate)}
          {year.isCurrent && currentTerm
            ? ` · ${s.currentYearHint(currentTerm.name)}`
            : null}
          {usage ? ` · ${usage}` : ` · ${s.usage.unused}`}
        </CardDescription>
        {canEdit ? (
          <CardAction className="flex items-center gap-1">
            {year.isCurrent ? null : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSetCurrentYear}
                aria-label={s.actions.setCurrentYear(year.name)}
              >
                <CalendarCheck />
                {s.actions.setCurrent}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditYear}
              aria-label={s.actions.editYear(year.name)}
            >
              <Pencil />
              {s.actions.edit}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={!year.canDelete}
              title={year.canDelete ? undefined : s.remove.blockedHint}
              onClick={onDeleteYear}
              aria-label={s.actions.deleteYear(year.name)}
            >
              <Trash2 />
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="p-0">
        {year.terms.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{s.noTerms}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.columns.term}</TableHead>
                <TableHead>{s.columns.starts}</TableHead>
                <TableHead>{s.columns.ends}</TableHead>
                {canEdit ? <TableHead className="w-0" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {year.terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {term.name}
                      {term.isCurrent ? (
                        <Badge variant="success">{s.current}</Badge>
                      ) : null}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {s.usage.term(term.usage) || s.usage.unused}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{term.startDate}</TableCell>
                  <TableCell className="tabular-nums">{term.endDate}</TableCell>
                  {canEdit ? (
                    <TableCell className="text-right whitespace-nowrap">
                      {/* Only a term of the current year can take over — the
                          year and term flags always move together. */}
                      {year.isCurrent && !term.isCurrent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSetCurrentTerm(term)}
                          aria-label={s.actions.setCurrentTerm(term.name)}
                        >
                          <CalendarCheck />
                          {s.actions.setCurrent}
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditTerm(term)}
                        aria-label={s.actions.editTerm(term.name)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!term.canDelete}
                        title={term.canDelete ? undefined : s.remove.blockedHint}
                        onClick={() => onDeleteTerm(term)}
                        aria-label={s.actions.deleteTerm(term.name)}
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

      {canEdit ? (
        <CardContent>
          <Button variant="outline" size="sm" onClick={onAddTerm}>
            <Plus />
            {s.actions.addTerm}
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}
