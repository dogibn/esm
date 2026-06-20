"use client";

import { useCallback, useRef } from "react";

import type { ProposalListResponseWire } from "../types";

import { ReviewTable, type ReviewTableHandle } from "./ReviewTable";
import { UploadDropzone } from "./UploadDropzone";

type Props = {
  initialProposals: ProposalListResponseWire;
};

export function ImportsView({ initialProposals }: Props) {
  const reviewRef = useRef<ReviewTableHandle>(null);

  const onUploadComplete = useCallback(() => {
    void reviewRef.current?.refresh();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <UploadDropzone onUploadComplete={onUploadComplete} />
      <ReviewTable initialData={initialProposals} handleRef={reviewRef} />
    </div>
  );
}
