"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { PageContainer } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="flex flex-col">
      {/* Full-bleed banner */}
      <div className="bg-linear-to-r from-primary to-primary/70 text-primary-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-5 sm:px-6">
          <Link
            href="/students"
            aria-label={t.back}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors outline-none hover:bg-primary-foreground/15 focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
          >
            <ArrowLeft aria-hidden className="size-4.5" />
          </Link>
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="truncate text-2xl font-bold">{fullName}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-primary-foreground/80">
              <span>{t.studentId(header.code)}</span>
              <span aria-hidden>·</span>
              <span>{header.gradeName}</span>
              <span aria-hidden>·</span>
              <span>{isNew ? t.categoryNew : t.categoryReturning}</span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-lg bg-primary-foreground/15 px-3 py-1.5 text-sm font-medium">
              {header.academicYearName}
            </span>
          </div>
        </div>
      </div>

      <PageContainer>
        {/* Two-column layout */}
        <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            <PersonalInfoCard header={header} />
            <TuitionBreakdownCard tuition={tuition} />
          </div>

          <Card size="sm" className="gap-0 self-start">
            <Tabs defaultValue="fees" className="gap-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
                <TabsList variant="line">
                  <TabsTrigger value="fees">{t.tabs.fees}</TabsTrigger>
                  <TabsTrigger value="history">{t.tabs.history}</TabsTrigger>
                </TabsList>
                <StatusBadge status={overallStatus(totals)} />
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
      </PageContainer>
    </div>
  );
}
