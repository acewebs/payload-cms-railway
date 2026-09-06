# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- Install every dependency, including the ones only the build needs ----
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# ---- Build the Next.js + Payload application ----
FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
# Build cache, not needed to serve, and dropped here so it never reaches a layer
# of the runtime image.
RUN rm -rf .next/cache

# ---- Resolve the runtime dependency tree on its own ----
FROM base AS prod-deps
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV NODE_OPTIONS=--no-deprecation
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --chown=nextjs:nodejs public ./public
# Next.js standalone output is deliberately not used: `payload migrate` needs the
# Payload CLI, the config and the migration files at runtime, which the traced
# standalone bundle does not carry. src and the production dependency tree are
# copied in full instead.
COPY --chown=nextjs:nodejs src ./src
COPY --chown=nextjs:nodejs scripts ./scripts
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./docker/entrypoint.sh
COPY --chown=nextjs:nodejs package.json next.config.ts tsconfig.json ./

# Only used when no bucket is configured. Created here because the non-root user
# cannot create it at /app, and an unwritable upload directory fails obscurely.
RUN mkdir -p /app/media && chown nextjs:nodejs /app/media

USER nextjs

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
