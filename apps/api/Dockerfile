FROM node:22-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @prospex/database exec prisma generate
RUN pnpm --filter @prospex/api build

FROM node:22-alpine AS runner
WORKDIR /app
RUN npm install -g pnpm

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

RUN addgroup -S prospex && adduser -S prospex -G prospex
USER prospex

WORKDIR /app/apps/api
CMD ["node", "dist/main"]
