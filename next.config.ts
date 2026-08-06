import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker
  // runner stage can ship just that + .next/static + public, without
  // node_modules. Required for the Cloud Run image. See Dockerfile.
  output: "standalone",
};

// withSentryConfig is safe to keep on unconditionally: without SENTRY_DSN the
// runtime SDK is disabled, and without SENTRY_AUTH_TOKEN the build simply
// skips source-map upload (a warning, not an error). Set both in Vercel to
// get readable stack traces in Sentry.
export default withSentryConfig(nextConfig, {
  silent: !process.env["CI"],
  disableLogger: true,
});
