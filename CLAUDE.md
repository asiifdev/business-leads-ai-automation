# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Prospex — a self-hosted, open-source outreach platform for selling to local businesses: Google Maps lead scraping, scoring, AI drafts in the owner's own voice, a human-approval Outbox, WhatsApp sending (Baileys) with pacing limits, replies and follow-ups as drafts, and a CRM pipeline. Turborepo/pnpm monorepo.

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

pnpm --filter @prospex/api test                        # unit tests (node:test via tsx): parser, style stats, send policy, opt-out, draft risk
DATABASE_URL=... WORKSPACE_ID=... pnpm --filter @prospex/api exec tsx scripts/pipeline-check.ts   # sender + inbound against a real DB with a fake WhatsApp provider
pnpm test:e2e                                          # Playwright e2e against localhost:3000/3001 (servers must already be running)
pnpm test:e2e:ui                                       # Playwright UI mode
npx playwright test tests/e2e/leads.spec.ts            # run a single e2e spec
```

Tests: `apps/api` has unit tests next to the code (`*.test.ts`, run with `pnpm --filter @prospex/api test`) and `scripts/pipeline-check.ts`; `tests/e2e/*.spec.ts` (Playwright) runs against a fully built+running stack (see `.github/workflows/ci.yml`: build API/web, start both, poll `/api/health`, then run tests). Set `WHATSAPP_DISABLED=true` in CI so the sender and Baileys stay off.

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

### Campaign → scrape → score pipeline
1. `POST /api/scraper/campaigns/:id/start` (`apps/api/src/scraper/scraper.controller.ts`) enqueues a BullMQ job on the `scraper` queue (Redis-backed, `scraper.module.ts`).
2. `ScraperProcessor` is the worker: it drives `GoogleMapsScraperService` (Playwright) and updates `Campaign.status`/`progress` (`draft → running → completed|failed`).
3. Raw leads are scored by `LeadIntelligenceService` (rule-based, no AI needed). For HIGH-priority leads `MarketingAiService` may add email/LinkedIn/call notes (`marketingContent.source === "llm"`); it returns `null` when no AI provider is configured. It never produces canned text, and it no longer writes WhatsApp/Instagram messages.

State is threaded through by hand rather than a state machine, so when changing this pipeline check `scraper.controller`, `scraper.processor`, the `ai` services and `campaigns.service`.

### AI (`apps/api/src/ai`)
- `AiClientService`: OpenAI-compatible chat and embeddings (`OPENAI_BASE_URL` can point at OpenRouter or Ollama). With `OPENAI_API_KEY` empty `enabled` is false and AI features refuse to run.
- `KnowledgeService`: chunks and vectors (pgvector), two-tier confidence (high/low/none) so drafts do not state facts the knowledge base lacks.
- `StyleService` + `chat-import/`: parse WhatsApp exports, compute style statistics, store anonymized (incoming → reply) pairs with embeddings, retrieve similar pairs. Never store raw chats. Vectors are only compared within the same `embeddingModel` and `dimensions`.
- `chat-import/style-prompt.ts` builds prompts. Text from outside (scraped listings, customers, exported chats) must stay inside `<data_*>` / `<pesan_pelanggan>` delimiters and go through `clip()`; do not interpolate it into instructions.

### Marketing (`apps/api/src/marketing`)
Read `docs/marketing-brief.md` and `docs/architecture.md` first. Invariants to keep:
- **Anything that opens a user-supplied address goes through `url-fetch.ts` (and `SafeProxy` for the browser).** Never call `fetch` or open a page with a user URL directly.
- **Parsers stay linear.** No regex that can backtrack on `<` without `>`; search for tag ends within a bounded window; cap output while building it. The tests include hostile inputs with time limits: keep adding to them.
- **Evidence must be grounded.** `groundBrief` removes numbers, customers, testimonials and prices that are not in the sources. The draft writer may only mention proof that is in the brief.
- **Customer search terms are business types**, not job titles or the seller's own services (`isCustomerBusinessTerm`).
- PDF parsing runs in a worker thread; keep it that way.
- The scraper never fabricates leads. If you need fake data for a test use `SCRAPER_MODE=fixture`.
- Lead scores come from listing signals plus `FitService`; do not reintroduce hard-coded industry or city weights.

### Messaging (`apps/api/src/messaging`)
Read `docs/architecture.md` and `docs/whatsapp-outbox.md` first. Invariants to keep:
- **Nothing sends without approval.** Drafts (`ai_outreach`, `ai_reply`, `ai_followup`, `manual`) enter the queue only through `MessagingService.approve`.
- **Claim, then send.** `SenderService` claims a message with `updateMany(status: approved → sending)`. A message found in `sending` after a restart is marked failed, never resent.
- **Send policy is pure** (`send-policy.ts`) and unit tested. Change limits there, not inline.
- **WhatsApp is behind `WhatsappProvider`**, routed per workspace by `WhatsappGateway`. The official Cloud API is a hosted-only feature (`whatsapp.cloud_api`) delivered by a separate private package, never committed here. See `docs/editions.md`.
- **Opt-out is absolute.** `message_opt_outs` is checked at approve time and again at send time.
- Inbound text from customers is untrusted: keep it delimited in prompts, and keep `draftRisks`/`looksLikeInjection` flagging.

### Secrets at rest
Integration secrets (e.g. a workspace's own OpenAI key under `Settings → Integrations`) are encrypted with AES-256-GCM using `ENCRYPTION_KEY` before being stored — never store or log third-party API keys in plaintext.

### Cross-cutting API conventions
- Global `ValidationPipe({ transform: true, whitelist: true })` — DTOs (`*/dto/*.dto.ts`, `class-validator`) are the contract; unknown properties are stripped, not just ignored.
- Global `HttpExceptionFilter` (`apps/api/src/common/filters`) normalizes error responses.
- Global `ThrottlerGuard` (60 req/60s default) applies to every route unless overridden.
- Module-per-domain layout under `apps/api/src/*` (`campaigns`, `leads`, `analytics`, `export`, `settings`, `workspace`, `ai`, `messaging`) — each is `*.module.ts` + `*.controller.ts` + `*.service.ts` + optional `dto/`; follow this shape for new domains.

### Frontend
`apps/web` uses shadcn/ui primitives (`src/components/ui`) + Tailwind, feature components grouped by domain under `src/components/{leads,campaigns,analytics,settings,integrations,dashboard,auth,layout,style,outbox}` mirroring the API's module boundaries. UI text goes through `useI18n().t(key)`: add every new string to `src/lib/i18n/en.ts` and `id.ts` (Indonesian must define every key). Server components may import only from `src/lib/i18n/lang.ts` (the rest is a client module). Talks to the API via `NEXT_PUBLIC_API_URL` (must include the `/api` path).

## Conventions
- Conventional Commits (`feat(leads): ...`, `fix(auth): ...`) — see `CONTRIBUTING.md`.
- TypeScript everywhere; avoid `any`.
- CI (`ci.yml`) runs on self-hosted runners and gates on: typecheck (API+web) → build (API+web) → e2e (Playwright against a real Postgres+Redis+built servers). Any PR should pass `tsc --noEmit` on both `api` and `web` locally first.
