import { withErrorHandler } from "@/lib/errors";
import { HttpError } from "@/lib/errors";
import { requireUser } from "@/lib/auth";
import { uploadBankTransactions } from "@/features/imports";
import { uploadFileSchema } from "@/features/imports/schemas";
import type { UploadResultWire } from "@/features/imports/types";

export const POST = withErrorHandler(async (req) => {
  await requireUser(req);
  const form = await req.formData();
  const fileField = form.get("file");
  if (!(fileField instanceof File)) {
    throw new HttpError(400, "No file uploaded");
  }

  const file = uploadFileSchema.parse(fileField);

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadBankTransactions(buffer);

  const wire: UploadResultWire = {
    parsedCount: result.parsedCount,
    insertedCount: result.insertedCount,
    skippedDuplicates: result.skippedDuplicates,
    skippedOutgoing: result.skippedOutgoing,
    inserted: result.inserted.map((r) => ({
      ...r,
      transactionAt: r.transactionAt.toISOString(),
    })),
    parseErrors: result.parseErrors,
  };

  return Response.json(wire);
});
