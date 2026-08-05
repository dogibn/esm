"use client";

import { Fragment, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { formatMnt } from "../format";
import { FEES_TABS, type FeesTab } from "../schemas";
import { TUITION_FEE_NAME } from "../shape";
import { strings } from "../strings";
import type { FeeRateRow, FeesOverview, SchoolFeeGroup } from "../types";

import { PublishRateDialog } from "./PublishRateDialog";

const s = strings;

export function FeesView({
  overview,
  tab: initialTab,
  canEdit,
}: {
  overview: FeesOverview;
  tab: FeesTab;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<FeesTab>(initialTab);
  const [dialog, setDialog] = useState<{ open: boolean; fee: SchoolFeeGroup | null }>({
    open: false,
    fee: null,
  });

  const tuition =
    overview.schoolFees.find((f) => f.feeName === TUITION_FEE_NAME) ?? null;
  const otherFees = overview.schoolFees.filter((f) => f.feeName !== TUITION_FEE_NAME);

  // Shallow URL update: the section stays linkable and survives a refresh
  // without re-running the server component — every tab reads the same load.
  const onTabChange = (next: FeesTab) => {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={canEdit ? s.page.description : s.page.adminHint}
      />

      <Tabs
        value={tab}
        onValueChange={(next) => onTabChange(next as FeesTab)}
        className="gap-4"
      >
        {/* The label lands on the tablist, not the wrapper. */}
        <TabsList variant="line" aria-label={s.tabs.label}>
          {FEES_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {s.tabs[value]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="tuition">
          {tuition ? (
            <SchoolFeeCard
              fee={tuition}
              canEdit={canEdit}
              onPublish={() => setDialog({ open: true, fee: tuition })}
            />
          ) : (
            <Card size="sm">
              <CardContent>
                <p className="py-6 text-sm text-muted-foreground">{s.tuition.empty}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="clubs">
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle>{s.clubs.title}</CardTitle>
              <CardDescription>{s.clubs.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {overview.clubTerms.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  {s.clubs.empty}
                </p>
              ) : (
                <div className="flex flex-col">
                  {overview.clubTerms.map((term) => (
                    <div key={term.termId} className="border-b last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2">
                        <span className="text-sm font-medium">
                          {s.clubs.termLabel(term.termName, term.yearName)}
                        </span>
                        {term.isCurrent ? (
                          <Badge variant="success">{s.clubs.current}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {s.clubs.count(term.fees.length)}
                        </span>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{s.columns.club}</TableHead>
                            <TableHead>{s.columns.amount}</TableHead>
                            <TableHead>{s.columns.teacher}</TableHead>
                            <TableHead>{s.columns.schedule}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {term.fees.map((club) => (
                            <TableRow key={club.id}>
                              <TableCell className="font-medium">
                                {club.feeName}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {club.amount === null ? "—" : formatMnt(club.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {club.teacher ?? "—"}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {club.schedule ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="others">
          <Card size="sm">
            <CardHeader className="border-b pb-3">
              <CardTitle>{s.others.title}</CardTitle>
              <CardDescription>{s.others.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {otherFees.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  {s.others.empty}
                </p>
              ) : (
                <OtherFeesTable
                  fees={otherFees}
                  canEdit={canEdit}
                  onPublish={(fee) => setDialog({ open: true, fee })}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {canEdit ? (
        <PublishRateDialog
          open={dialog.open}
          fee={dialog.fee}
          levels={overview.levels}
          onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        />
      ) : null}
    </PageContainer>
  );
}

/**
 * Every school-wide fee except tuition, one row each: name, the amount in
 * force, and the date it applies from. A row expands to what a table cell
 * can't hold — a per-grade breakdown, and the rates this one replaced.
 */
function OtherFeesTable({
  fees,
  canEdit,
  onPublish,
}: {
  fees: SchoolFeeGroup[];
  canEdit: boolean;
  onPublish: (fee: SchoolFeeGroup) => void;
}) {
  const [openFee, setOpenFee] = useState<string | null>(null);
  const columnCount = canEdit ? 4 : 3;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{s.others.columns.name}</TableHead>
          <TableHead>{s.others.columns.amount}</TableHead>
          <TableHead>{s.others.columns.from}</TableHead>
          {canEdit ? <TableHead className="w-0" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {fees.map((fee) => {
          const open = openFee === fee.feeName;
          const hasDetail =
            fee.history.length > 0 || fee.current?.shape === "by_grade";
          return (
            <Fragment key={fee.feeName}>
              <TableRow>
                <TableCell className="font-medium">
                  <button
                    type="button"
                    disabled={!hasDetail}
                    aria-expanded={hasDetail ? open : undefined}
                    aria-label={s.others.expand(fee.label)}
                    onClick={() => setOpenFee(open ? null : fee.feeName)}
                    className="flex items-center gap-1.5 text-left disabled:cursor-default"
                  >
                    <ChevronRight
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${
                        open ? "rotate-90" : ""
                      } ${hasDetail ? "" : "invisible"}`}
                    />
                    {fee.label}
                  </button>
                </TableCell>
                <TableCell className="tabular-nums">{amountLabel(fee)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {fee.current ? fee.current.effectiveFrom : s.noCurrent}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onPublish(fee)}
                      aria-label={s.publish.actionFor(fee.label)}
                    >
                      <Plus />
                      {s.publish.action}
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>

              {open && hasDetail ? (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="bg-muted/30 whitespace-normal"
                  >
                    <div className="flex flex-col gap-3">
                      {fee.current?.shape === "by_grade" ? (
                        <div className="overflow-hidden rounded-lg border bg-background">
                          <RateBody rate={fee.current} />
                        </div>
                      ) : null}
                      {fee.history.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-medium text-muted-foreground">
                            {s.history.title}
                          </p>
                          {fee.history.map((rate) => (
                            <div
                              key={rate.id}
                              className="rounded-lg border bg-background p-3"
                            >
                              <p className="mb-2 text-xs text-muted-foreground">
                                {s.from(rate.effectiveFrom)}
                                {rate.supersededAt
                                  ? ` · ${s.replacedOn(rate.supersededAt.slice(0, 10))}`
                                  : null}
                              </p>
                              <RateBody rate={rate} />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

// What fits in one cell. A per-grade fee has no single amount — its breakdown
// is in the expanded row.
function amountLabel(fee: SchoolFeeGroup): string {
  if (!fee.current) return s.others.noAmount;
  if (fee.current.shape === "flat") return formatMnt(fee.current.amount ?? 0);
  if (fee.current.shape === "by_grade") return s.others.perGrade;
  return s.others.noAmount;
}

function RateBody({ rate }: { rate: FeeRateRow }) {
  if (rate.shape === "flat") {
    return (
      <span className="text-lg font-semibold tabular-nums">
        {formatMnt(rate.amount ?? 0)}
      </span>
    );
  }
  if (rate.shape === "by_grade") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{s.columns.level}</TableHead>
            <TableHead>{s.columns.amount}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rate.byGrade ?? []).map((entry) => (
            <TableRow key={entry.code}>
              <TableCell className="font-medium">{entry.code}</TableCell>
              <TableCell className="tabular-nums">{formatMnt(entry.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  return <span className="text-sm text-muted-foreground">{s.unknownShape}</span>;
}

function SchoolFeeCard({
  fee,
  canEdit,
  onPublish,
}: {
  fee: SchoolFeeGroup;
  canEdit: boolean;
  onPublish: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <Card size="sm">
      <CardHeader className="border-b pb-3">
        <CardTitle className="flex items-center gap-2">
          {fee.label}
          {fee.current ? <Badge variant="success">{s.current}</Badge> : null}
        </CardTitle>
        <CardDescription>
          {fee.current ? s.from(fee.current.effectiveFrom) : s.noCurrent}
        </CardDescription>
        {canEdit ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={onPublish}
              aria-label={s.publish.actionFor(fee.label)}
            >
              <Plus />
              {s.publish.action}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className={fee.current?.shape === "by_grade" ? "p-0" : undefined}>
        {fee.current ? (
          <RateBody rate={fee.current} />
        ) : (
          <p className="text-sm text-muted-foreground">{s.noCurrent}</p>
        )}
      </CardContent>

      <CardContent className="border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={fee.history.length === 0}
          onClick={() => setShowHistory((v) => !v)}
        >
          {fee.history.length === 0
            ? s.history.empty
            : showHistory
              ? s.history.toggleHide
              : s.history.toggleShow}
        </Button>

        {showHistory && fee.history.length > 0 ? (
          <div className="mt-2 flex flex-col gap-3">
            {fee.history.map((rate) => (
              <div key={rate.id} className="rounded-lg border p-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  {s.from(rate.effectiveFrom)}
                  {rate.supersededAt
                    ? ` · ${s.replacedOn(rate.supersededAt.slice(0, 10))}`
                    : null}
                </p>
                <RateBody rate={rate} />
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
