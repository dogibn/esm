import { z } from "zod";

// Client-safe env vars. Each one MUST be referenced statically as
// `process.env.NEXT_PUBLIC_X` — that exact text is what Next.js replaces with
// the value at build time. Passing `process.env` to Zod dynamically (as
// lib/env.ts does) yields an empty object in the browser and in edge bundles.
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const parsed = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Missing or invalid public environment variables: ${missing}`);
}

export const clientEnv = parsed.data;
