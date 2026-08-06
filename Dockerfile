##########################################################################
# base — Node 20 with pnpm enabled via corepack.
# pnpm is pinned to match the committed lockfile (lockfileVersion 9.0);
# there is no packageManager field in package.json, so corepack needs the
# version spelled out here.
##########################################################################
FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

##########################################################################
# deps — install node_modules from the committed lockfile, frozen.
# Only the manifest + lockfile are copied so this layer caches until a
# dependency actually changes.
##########################################################################
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

##########################################################################
# build — run `next build`, producing the standalone server output.
#
# NEXT_PUBLIC_* are inlined into the client bundle by Next at BUILD time,
# so they must be present here. They are public (not secret) and arrive as
# build args. The runtime-only secrets — DATABASE_URL, DIRECT_URL,
# SUPABASE_SERVICE_ROLE_KEY — are deliberately NOT provided at build time;
# lib/env.ts and db/index.ts validate/connect lazily so the build needs
# only the NEXT_PUBLIC vars.
##########################################################################
FROM base AS build
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

##########################################################################
# runner — minimal production image, non-root.
# Ships only the standalone bundle (which carries its own trimmed
# node_modules + server.js), plus .next/static and public/.
##########################################################################
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run injects PORT (defaults to 8080). Next's standalone server reads
# PORT and HOSTNAME; bind 0.0.0.0 so the container is reachable. Not hardcoded
# to 3000 — PORT can be overridden by the platform at runtime.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
