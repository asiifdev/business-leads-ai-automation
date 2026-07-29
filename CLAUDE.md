# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Prospex — a self-hosted, open-source GTM automation platform (Google Maps lead scraping + AI-scored leads + AI-generated outreach + CRM pipeline). Turborepo/pnpm monorepo.

## Commands

Run everything from the repo root; use `--filter` to target a single package.

```bash
pnpm install                                          # install all workspaces
docker compose up -d                                  # start PostgreSQL 16 + Redis 7 for local dev
pnpm --filter @prospex/database db:push               # push Prisma schema (dev)
pnpm --filter @prospex/database db:migrate            # create/apply a migration (dev)
pnpm --filter @prospex/database db:deploy             # apply migrations (CI/prod)
pnpm --filter @prospex/database exec prisma generate  # regenerate Prisma client (needed after schema.prisma changes)
pnpm --filter @prospex/database db:studio             # Prisma Studio

pnpm --filter @prospex/api dev                        # NestJS API, http://localhost:3001 (prefix /api)
pnpm --filter @prospex/web dev                        # Next.js dashboard, http://localhost:3000
pnpm --filter @prospex/marketing dev                  # marketing site, http://localhost:3002

pnpm --filter @prospex/api exec tsc --noEmit          # typecheck API — must be clean before a PR
pnpm --filter @prospex/web exec tsc --noEmit          # typecheck web — must be clean before a PR
pnpm build                                             # turbo build (all apps)
pnpm lint                                              # turbo lint (all apps)

pnpm test:e2e                                          # Playwright e2e against localhost:3000/3001 (servers must already be running)
pnpm test:e2e:ui                                       # Playwright UI mode
npx playwright test tests/e2e/leads.spec.ts            # run a single e2e spec
```

There are no unit test suites — `tests/e2e/*.spec.ts` (Playwright) is the only automated test layer, run against a fully built+running stack (see `.github/workflows/ci.yml` for the exact boot sequence: build API/web, start both, poll `/api/health`, then run tests).

Env files: copy `.env.example` to `apps/api/.env` and `packages/database/.env`. Required vars are validated at API boot via Joi in `apps/api/src/app.module.ts` (`DATABASE_URL`, `JWT_SECRET` ≥16 chars, `ENCRYPTION_KEY` base64, etc.) — the API will refuse to start if these are missing/invalid.

## Architecture

### Monorepo layout
- `apps/api` — NestJS 10 REST API, all routes under global prefix `/api`, Swagger at `/api/docs`
- `apps/web` — Next.js 16 (App Router) dashboard, route groups `(auth)` and `(dashboard)`
- `apps/marketing` — separate Next.js app for the marketing/landing site (port 3002)
- `packages/database` — single source of truth for the Prisma schema (`prisma/schema.prisma`); `src/index.ts` just re-exports `@prisma/client`. Both `api` and other packages depend on `@prospex/database` as a workspace package rather than importing Prisma directly.
- `packages/types` — shared TypeScript types across apps
- `_legacy` — old pre-monorepo script-based scraper; not part of the active build graph, do not wire it into `apps/*`

### Multi-tenancy
Everything in Prisma is scoped under `Workspace` (`packages/database/prisma/schema.prisma`): `Campaign`, `Lead`, `Contact`, `Integration`, `ApiKey` all carry a `workspaceId`. `WorkspaceMember` links `User`↔`Workspace` with a `role`. Auth (`apps/api/src/auth`) uses JWT sessions (`Session`/`Account` models, bcrypt) plus a separate `ApiKeyGuard` for API-key auth (`apps/api/src/auth/api-key.guard.ts`) — most endpoints resolve the acting workspace via the `@CurrentWorkspace()` decorator, not just the user.

### Campaign → scrape → score → content pipeline
This is the core async flow, and touches four modules together:
1. `POST /api/scraper/campaigns/:id/start` (`apps/api/src/scraper/scraper.controller.ts`) enqueues a BullMQ job on the `scraper` queue (Redis-backed, configured in `scraper.module.ts`).
2. `ScraperProcessor` (`scraper.processor.ts`) is the worker: it drives `GoogleMapsScraperService` (Playwright-based Google Maps scraping) to collect raw leads, updates `Campaign.status`/`progress` as it goes (`draft → running → completed|failed`).
3. Raw leads are scored via `LeadIntelligenceService` (`apps/api/src/ai`), then per-lead AI outreach content (email/WhatsApp/IG DM/LinkedIn/cold-call script) is generated via `MarketingAiService`.
4. Both AI services wrap the OpenAI SDK but are provider-agnostic — `OPENAI_BASE_URL` can point at OpenRouter or a local Ollama instance, and leaving `OPENAI_API_KEY` empty makes them fall back to deterministic mock content (this is what CI does, and it's the intended way to develop without burning API credits).

When changing anything in this pipeline, check all four pieces (`scraper.controller`, `scraper.processor`, the two `ai` services, `campaigns.service` for status transitions) since progress/state is threaded through by hand rather than via a saga/state machine.

### Secrets at rest
Integration secrets (e.g. a workspace's own OpenAI key under `Settings → Integrations`) are encrypted with AES-256-GCM using `ENCRYPTION_KEY` before being stored — never store or log third-party API keys in plaintext.

### Cross-cutting API conventions
- Global `ValidationPipe({ transform: true, whitelist: true })` — DTOs (`*/dto/*.dto.ts`, `class-validator`) are the contract; unknown properties are stripped, not just ignored.
- Global `HttpExceptionFilter` (`apps/api/src/common/filters`) normalizes error responses.
- Global `ThrottlerGuard` (60 req/60s default) applies to every route unless overridden.
- Module-per-domain layout under `apps/api/src/*` (`campaigns`, `leads`, `analytics`, `export`, `settings`, `workspace`) — each is `*.module.ts` + `*.controller.ts` + `*.service.ts` + optional `dto/`; follow this shape for new domains.

### Frontend
`apps/web` uses shadcn/ui primitives (`src/components/ui`) + Tailwind, feature components grouped by domain under `src/components/{leads,campaigns,analytics,settings,integrations,dashboard,auth,layout}` mirroring the API's module boundaries. Talks to the API via `NEXT_PUBLIC_API_URL` (must include the `/api` path).

## Conventions
- Conventional Commits (`feat(leads): ...`, `fix(auth): ...`) — see `CONTRIBUTING.md`.
- TypeScript everywhere; avoid `any`.
- CI (`ci.yml`) runs on self-hosted runners and gates on: typecheck (API+web) → build (API+web) → e2e (Playwright against a real Postgres+Redis+built servers). Any PR should pass `tsc --noEmit` on both `api` and `web` locally first.
