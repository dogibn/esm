import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as relations from "./relations";
import { env } from "@/lib/env";

const combinedSchema = { ...schema, ...relations };

declare global {
  // eslint-disable-next-line no-var
  var __db: ReturnType<typeof drizzle> | undefined;
}

type Db = ReturnType<typeof drizzle>;

function createDb(): Db {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle(client, { schema: combinedSchema });
}

// Instantiate LAZILY, on first use — not at module load. `next build` collects
// page data by evaluating server modules, and this one is in that graph. A
// module-load `createDb()` would read env.DATABASE_URL (a runtime-only secret
// absent at build time) and fail the build. A Proxy defers creation to the
// first real query, while preserving the singleton via globalThis (one client
// per process; also survives HMR in dev).
function resolveDb(): Db {
  return (globalThis.__db ??= createDb());
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const value = resolveDb()[prop as keyof Db];
    return typeof value === "function" ? value.bind(resolveDb()) : value;
  },
});
