import * as Sentry from "@sentry/nextjs";

// Next.js instrumentation hook. Loads the Sentry server config once, only on
// the Node.js runtime (this app has no edge runtime — see tech_stack.md §12).
export async function register() {
  if (process.env["NEXT_RUNTIME"] === "nodejs") {
    await import("./sentry.server.config");
  }
}

// Captures errors thrown in App Router server components / route handlers that
// Next surfaces via this hook. No-op when Sentry is disabled.
export const onRequestError = Sentry.captureRequestError;
