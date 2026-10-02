FROM node:22-alpine AS base

FROM base AS builder
# Set working directory
WORKDIR /app

# Install turbo
RUN npm install -g turbo
COPY . .
RUN turbo prune webhook-processor --docker

# Add lockfile and package.json's of isolated subworkspace
FROM base AS installer
WORKDIR /app

# First install dependencies (as they change less often)
COPY --from=builder /app/out/json/ .
RUN npm ci

# Build the project
COPY --from=builder /app/out/full/ .
RUN npx turbo build --filter=webhook-processor

FROM base AS runner
WORKDIR /app

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 fastify
USER fastify

COPY --from=installer /app .

CMD ["npm", "run", "start", "--workspace=webhook-processor"]
