"use client";

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { StudentDetail } from "../../detail";
import { formatMnt } from "../../format";
import { strings } from "../../strings";
import type { FeeStatus } from "../../types";

import { StatusBadge } from "../StatusBadge";

import { AnnualFeesTable } from "./AnnualFeesTable";
import { PaymentHistoryTable } from "./PaymentHistoryTable";
import { PersonalInfoCard } from "./PersonalInfoCard";
import { SectionHeading } from "./SectionHeading";
import { TermFeesTable } from "./TermFeesTable";
import { TuitionBreakdownCard } from "./TuitionBreakdownCard";

function overallStatus(totals: StudentDetail["totals"]): FeeStatus {
  if (totals.charged <= 0) return "none";
  if (totals.balance <= 0) return "paid";
  if (totals.paid > 0) return "partial";
  return "unpaid";
}

function TotalPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-muted-foreground">
      {label}:{" "}
      <span className="font-medium text-foreground tabular-nums">{value}</span>
    </span>
  );
}

export function StudentDetailView({ detail }: { detail: StudentDetail }) {
  const { header, tuition, annualFees, terms, termFees, payments, totals } =
    detail;
  const t = strings.detail;
  const fullName = `${header.firstName} ${header.lastName}`.trim();
  const isNew = header.studentCategory === "new";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <Link
          href="/students"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "self-start")}
        >
          ← {t.back}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold">{fullName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t.studentId(header.code)}</span>
              <span aria-hidden>·</span>
              <span>{header.gradeName}</span>
              <Badge variant="outline">
                {isNew ? t.categoryNew : t.categoryReturning}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{header.academicYearName}</Badge>
            <StatusBadge status={overallStatus(totals)} />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <PersonalInfoCard header={header} />
          <TuitionBreakdownCard tuition={tuition} />
        </div>

        <Card size="sm" className="gap-0">
          <Tabs defaultValue="fees" className="gap-0">
            <div className="border-b px-3 py-2">
              <TabsList variant="line">
                <TabsTrigger value="fees">{t.tabs.fees}</TabsTrigger>
                <TabsTrigger value="history">{t.tabs.history}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="fees" className="flex flex-col">
              <div className="px-4 pt-3 pb-1">
                <SectionHeading title={t.annual.title} />
              </div>
              <AnnualFeesTable fees={annualFees} />

              <div className="border-t px-4 pt-3 pb-1">
                <SectionHeading title={t.term.title} />
              </div>
              <TermFeesTable terms={terms} rows={termFees} />

              <div className="flex flex-wrap items-center justify-end gap-4 border-t bg-muted/40 px-4 py-3 text-sm">
                <TotalPill label={t.totals.charged} value={formatMnt(totals.charged)} />
                <TotalPill label={t.totals.paid} value={formatMnt(totals.paid)} />
                <TotalPill label={t.totals.balance} value={formatMnt(totals.balance)} />
              </div>
            </TabsContent>

            <TabsContent value="history">
              <CardContent className="py-3">
                <PaymentHistoryTable rows={payments} studentName={fullName} />
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
