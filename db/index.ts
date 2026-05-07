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

function createDb() {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  return drizzle(client, { schema: combinedSchema });
}

export const db =
  process.env.NODE_ENV === "production"
    ? createDb()
    : (globalThis.__db ??= createDb());
