FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Generate a partial monorepo with a pruned lockfile for the api
RUN turbo prune api --docker

# Install dependencies (cached unless the pruned lockfile changes)
FROM node:20-alpine AS installer
WORKDIR /app
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
# `npm ci` for reproducible installs; postinstall runs `prisma generate`.
RUN npm ci

# Build the project and its dependencies
COPY --from=builder /app/out/full/ .
RUN npx turbo run build --filter=api...

FROM node:20-alpine AS runner
WORKDIR /app

# Don't run production as root.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 fastify
USER fastify

COPY --from=installer --chown=fastify:nodejs /app .

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=api"]
