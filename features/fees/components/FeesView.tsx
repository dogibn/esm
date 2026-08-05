"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

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

import { formatMnt } from "../format";
import { strings } from "../strings";
import type { FeeRateRow, FeesOverview, SchoolFeeGroup } from "../types";

import { PublishRateDialog } from "./PublishRateDialog";

const s = strings;

export function FeesView({
  overview,
  canEdit,
}: {
  overview: FeesOverview;
  canEdit: boolean;
}) {
  const [dialog, setDialog] = useState<{ open: boolean; fee: SchoolFeeGroup | null }>({
    open: false,
    fee: null,
  });

  return (
    <PageContainer>
      <PageHeader
        title={s.page.title}
        description={canEdit ? s.page.description : s.page.adminHint}
      />

      {overview.schoolFees.length === 0 ? (
        <Card size="sm">
          <CardContent>
            <p className="py-6 text-sm text-muted-foreground">{s.schoolFees.empty}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {overview.schoolFees.map((fee) => (
            <SchoolFeeCard
              key={fee.feeName}
              fee={fee}
              canEdit={canEdit}
              onPublish={() => setDialog({ open: true, fee })}
            />
          ))}
        </div>
      )}

      <Card size="sm">
        <CardHeader className="border-b pb-3">
          <CardTitle>{s.clubs.title}</CardTitle>
          <CardDescription>{s.clubs.description}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {overview.clubTerms.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{s.clubs.empty}</p>
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
                          <TableCell className="font-medium">{club.feeName}</TableCell>
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
