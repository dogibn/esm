import { z } from "zod";

// SERVER-ONLY. Never import from client components, middleware, or anything
// they pull in — the dynamic `safeParse(process.env)` below sees an empty
// object outside the Node server, so every var reports as missing. Client
// code uses lib/env-client.ts (statically-referenced NEXT_PUBLIC_* only).
if (typeof window !== "undefined") {
  throw new Error(
    "lib/env.ts was imported into client code. Use lib/env-client.ts instead.",
  );
}

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(`Missing or invalid environment variables: ${missing}`);
}

export const env = parsed.data;
