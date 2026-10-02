FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Generate a partial monorepo with a pruned lockfile for the web app
RUN turbo prune web --docker

# Install dependencies (cached unless the pruned lockfile changes)
FROM node:20-alpine AS installer
WORKDIR /app
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Build the project and its dependencies (produces .next/standalone)
COPY --from=builder /app/out/full/ .
# NEXT_PUBLIC_* vars are inlined at build time, so the browser-facing API URL
# MUST be provided here — setting it only at runtime has no effect on client code.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npx turbo run build --filter=web...

FROM node:20-alpine AS runner
WORKDIR /app

# Don't run production as root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
USER nextjs

# Standalone output: server + only the traced deps, plus static assets.
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The standalone server entrypoint lives at the app's path within the bundle.
CMD ["node", "apps/web/server.js"]
