import * as Sentry from "@sentry/nextjs";

// Server-side error reporting. Entirely optional: with no SENTRY_DSN set,
// `enabled: false` makes every Sentry call a no-op, so local dev and any
// environment without the DSN behave exactly as before. Set SENTRY_DSN in
// Vercel (production) to turn it on — no code change needed.
Sentry.init({
  dsn: process.env["SENTRY_DSN"],
  enabled: !!process.env["SENTRY_DSN"],
  // Errors only. This is an internal tool for 5 users — performance tracing
  // would just burn quota. Bump if you later want latency traces.
  tracesSampleRate: 0,
  environment: process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"],
});
