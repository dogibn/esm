import * as dotenv from "dotenv";
import type { Config } from "drizzle-kit";

dotenv.config({ path: ".env.local" });
const directUrl = process.env["DIRECT_URL"];
if (!directUrl) throw new Error("DIRECT_URL environment variable is not set");

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: directUrl,
  },
} satisfies Config;
