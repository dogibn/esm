/**
 * Thin, dependency-optional error-reporting shim.
 *
 * Route handlers and services call `captureException` without importing Sentry
 * directly. If Sentry is installed AND `SENTRY_DSN` is set, the error is sent
 * there; otherwise this is a safe no-op and the console log in
 * `withErrorHandler` is the only record. This keeps the app booting and
 * deploying even when observability isn't configured yet.
 */
export async function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  if (!process.env["SENTRY_DSN"]) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // @sentry/nextjs not installed — console log is the fallback.
  }
}
