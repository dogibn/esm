"use client";

import { useRef, useState } from "react";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { strings } from "../strings";
import type { ParseError, UploadResultWire } from "../types";

const numberFormatter = new Intl.NumberFormat("en-US");
function formatAmount(n: number): string {
  return numberFormatter.format(n);
}

function formatDate(iso: string): string {
  // Display in UB local time so accountants see the same wall-clock as the bank file.
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Ulaanbaatar",
  }).format(d);
}

type UploadDropzoneProps = {
  onUploadComplete?: () => void;
};

export function UploadDropzone({ onUploadComplete }: UploadDropzoneProps = {}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResultWire | null>(null);

  const onChoose = () => inputRef.current?.click();

  const onSelected = (f: File | null) => {
    setFile(f);
    setResult(null);
    setError(null);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0] ?? null;
    onSelected(f);
  };

  const onUpload = async () => {
    if (!file) {
      setError(strings.errors.noFile);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/imports/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as UploadResultWire;
      setResult(json);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast({
        message: strings.toasts.imported(json.insertedCount),
        variant: "success",
      });
      onUploadComplete?.();
    } catch (e) {
      setError((e as Error).message || strings.errors.uploadFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{strings.title}</CardTitle>
          <CardDescription>{strings.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={
              "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-sm transition-colors " +
              (dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:border-primary/40")
            }
          >
            <span
              aria-hidden
              className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <FileUp className="size-5" />
            </span>
            <span className="font-medium">{strings.dropzone.label}</span>
            <span className="text-xs text-muted-foreground">
              {strings.dropzone.hint}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => onSelected(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={onChoose} disabled={loading}>
                {strings.dropzone.chooseFile}
              </Button>
              {file ? (
                <>
                  <span className="text-sm">{strings.dropzone.fileChosen(file.name)}</span>
                  <Button size="sm" onClick={onUpload} disabled={loading}>
                    {loading ? strings.dropzone.uploading : strings.dropzone.upload}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelected(null)}
                    disabled={loading}
                  >
                    {strings.dropzone.cancel}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
          {error ? <div className="pt-3 text-sm text-destructive">{error}</div> : null}
        </CardContent>
      </Card>

      {result ? <ResultPanel result={result} /> : null}
    </div>
  );
}

function ResultPanel({ result }: { result: UploadResultWire }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{strings.result.heading}</CardTitle>
        <CardDescription>
          {strings.result.parsedCount(result.parsedCount)}
          {" · "}
          {strings.result.insertedCount(result.insertedCount)}
          {" · "}
          {strings.result.skippedDuplicates(result.skippedDuplicates)}
          {" · "}
          {strings.result.skippedOutgoing(result.skippedOutgoing)}
          {" · "}
          {strings.result.parseErrors(result.parseErrors.length)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <InsertedTable rows={result.inserted} />
        <ParseErrorList errors={result.parseErrors} />
      </CardContent>
    </Card>
  );
}

function InsertedTable({ rows }: { rows: UploadResultWire["inserted"] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{strings.result.insertedHeading}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.result.noInserted}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{strings.columns.transactionId}</TableHead>
              <TableHead>{strings.columns.transactionAt}</TableHead>
              <TableHead>{strings.columns.senderName}</TableHead>
              <TableHead>{strings.columns.senderAccount}</TableHead>
              <TableHead>{strings.columns.memo}</TableHead>
              <TableHead>{strings.columns.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.transactionId}>
                <TableCell className="font-mono text-xs">{r.transactionId}</TableCell>
                <TableCell>{formatDate(r.transactionAt)}</TableCell>
                <TableCell>{r.senderName ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.senderAccount ?? "—"}</TableCell>
                <TableCell className="max-w-[24rem] truncate" title={r.memo ?? ""}>
                  {r.memo ?? "—"}
                </TableCell>
                <TableCell className="tabular-nums">{formatAmount(r.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ParseErrorList({ errors }: { errors: ParseError[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{strings.result.parseErrorsHeading}</h3>
      {errors.length === 0 ? (
        <p className="text-sm text-muted-foreground">{strings.result.noParseErrors}</p>
      ) : (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {errors.map((e, i) => (
            <li key={i}>{strings.result.parseErrorRow(e.rowIndex, e.reason)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
