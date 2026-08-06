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

type Env = z.infer<typeof envSchema>;

// Validate LAZILY, on first property access — not at module load. `next build`
// pulls this module into the build graph (via server route handlers), but the
// runtime-only secrets (DATABASE_URL, DIRECT_URL, SUPABASE_SERVICE_ROLE_KEY)
// are deliberately absent at build time. Parsing eagerly here would throw and
// fail the build. Deferring validation to the first read means the build needs
// only what it actually inlines (the NEXT_PUBLIC_* vars), while a running
// server still fails fast the moment it touches a missing/invalid var.
let cached: Env | undefined;

function loadEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}

// A Proxy keeps the existing `env.DATABASE_URL` call sites unchanged: each
// property read triggers validation (memoized) instead of a load-time parse.
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});
