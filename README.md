<div align="center">
  <h1> 🚀 Sponsored by CoreClaw</h1>
</div>
<a href="https://www.coreclaw.com/?utm_source=github&utm_medium=referral&utm_campaign=asiifdev&utm_term=&utm_id=asiifdev">
  <img
    src="./docs/images/coreclaw-banner.png"
    alt="CoreClaw - Turn Google Maps Data Into Real Business Leads"
    width="100%"
  />
</a>

<div align="center">
  <p>
Turn Google Maps Data Into Real Business Leads
Find websites, emails, and business contacts from Google Maps in minutes.
    </p>
</div>

<p align="center">
  <a href="https://www.coreclaw.com/?utm_source=github&utm_medium=referral&utm_campaign=asiifdev&utm_term=&utm_id=asiifdev">
    <img src="https://img.shields.io/badge/Get_1,000_Free_Leads-22C55E?style=for-the-badge&logo=googlemaps&logoColor=white" alt="Get 1,000 Free Leads">
  </a>
</p>

---

<div align="center">
  <h1>Prospex</h1>
  <p><strong>Open-source AI-powered GTM automation platform</strong></p>
  <p>Find leads · Score them with AI · Generate personalized outreach · Close deals</p>

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
  [![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://docs.docker.com/compose/)
</div>

## What is Prospex?

Prospex is a **self-hosted, open-source** platform that combines lead discovery, AI-powered outreach generation, and CRM management in one dashboard.

Think Apollo.io + Instantly.ai — but open-source, self-hosted, and free.

### Features

| Module | Description |
|--------|-------------|
| **Lead Discovery** | Scrape Google Maps with AI-powered lead scoring |
| **AI Content Engine** | Personalized Email, WhatsApp, Instagram DM, LinkedIn, Cold Call scripts per lead |
| **Campaign Manager** | Multi-query batch campaigns with real-time progress tracking |
| **CRM Pipeline** | Full lead lifecycle: New → Contacted → Replied → Won/Lost |
| **Analytics** | Conversion funnel, industry breakdown, campaign ROI |
| **Export** | Download leads as CSV, JSON, or vCard |
| **API** | REST API with Swagger docs + API key management |

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, App Router, shadcn/ui, Tailwind CSS, Recharts |
| **Backend** | NestJS 10, Prisma ORM, REST API |
| **Database** | PostgreSQL 16 |
| **Queue** | BullMQ + Redis 7 |
| **AI** | OpenAI SDK (supports OpenRouter & Ollama) |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Deploy** | Docker Compose |

---

## Quickstart

### Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [pnpm 9+](https://pnpm.io/)
- [Docker](https://www.docker.com/)

### 1. Clone & install

```bash
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
cp .env.example packages/database/.env
```

Edit `apps/api/.env` with your values:
```env
DATABASE_URL="postgresql://prospex:yourpassword@localhost:5432/prospex"
OPENAI_API_KEY=sk-your-key-here   # or leave empty for mock AI
OPENAI_MODEL=gpt-4o-mini
# Optional: use OpenRouter or Ollama
# OPENAI_BASE_URL=https://openrouter.ai/api/v1
```

### 3. Start infrastructure

```bash
docker compose up -d         # starts PostgreSQL + Redis
pnpm --filter @prospex/database db:push   # push schema
pnpm --filter @prospex/database exec prisma generate
```

### 4. Run development servers

```bash
# Terminal 1 — API (port 3001)
pnpm --filter @prospex/api dev

# Terminal 2 — Dashboard (port 3000)
pnpm --filter @prospex/web dev
```

Open [http://localhost:3000](http://localhost:3000) and you're in.

Swagger API docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

## Project Structure

```
prospex/
├── apps/
│   ├── web/              # Next.js 16 dashboard
│   ├── api/              # NestJS REST API
│   └── marketing/        # Landing page
├── packages/
│   ├── database/         # Prisma schema + migrations
│   ├── types/            # Shared TypeScript types
│   └── config/           # Shared eslint/tsconfig
├── docker-compose.yml        # Local dev (PostgreSQL + Redis)
├── docker-compose.prod.yml   # Production stack
└── nginx.conf                # Nginx reverse proxy config
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET/POST` | `/api/campaigns` | List / create campaigns |
| `GET/PATCH/DELETE` | `/api/campaigns/:id` | Campaign detail / update / delete |
| `POST` | `/api/scraper/campaigns/:id/start` | Start scraping + AI pipeline |
| `GET` | `/api/leads` | List leads (filter by `?campaignId=`) |
| `PATCH` | `/api/leads/:id/crm` | Update CRM status |
| `GET` | `/api/analytics` | Overview stats |
| `GET` | `/api/analytics/industries` | Leads by industry |
| `GET` | `/api/export/leads/csv` | Export leads as CSV |
| `GET` | `/api/export/leads/json` | Export leads as JSON |
| `GET` | `/api/export/leads/vcard` | Export leads as vCard |
| `GET/POST/DELETE` | `/api/settings/api-keys` | API key management |
| `GET/POST` | `/api/settings/integrations` | Integration config |

Full interactive docs at `/api/docs` (Swagger).

---

## Using OpenRouter / Ollama

Prospex supports any OpenAI-compatible AI provider:

**OpenRouter** (access Claude, Gemini, Llama, etc.):
```env
OPENAI_API_KEY=sk-or-your-openrouter-key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-haiku-4-5
```

**Ollama** (local, fully offline):
```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.2
```

---

## Production Deployment

```bash
cp .env.example .env
# Edit .env with production values (strong passwords, real API key)

docker compose -f docker-compose.prod.yml up -d
```

This starts: PostgreSQL + Redis + NestJS API + Next.js + Nginx.

---

## Development

```bash
pnpm install            # install all dependencies
pnpm dev                # start all apps (requires turbo)
pnpm build              # build all apps
pnpm --filter @prospex/database db:studio   # Prisma Studio (DB browser)
```

---

## Changelog

### 2026-07-29
- **Fix**: search queries now combine each campaign's search term with every area in its `location` field (split on commas) before scraping — previously `location` was stored but never sent to the scraper, so results could drift to the scraping server's IP-based region instead of the requested cities.
- **Feature**: leads now capture `lat`/`lng` coordinates (parsed from the scraped Google Maps place URL) and store them on the `Lead` model.
- **Feature**: campaign detail page has a new "Map" tab with a Leaflet-based lead map (custom priority-colored markers, auto-fit bounds, popups linking to lead detail) alongside the existing "List" view.
- **Fix**: scraping progress no longer gets stuck at 0% — the scraper now reports incremental progress per search query/area combo while scraping runs (previously progress only updated before scraping started and after it fully finished, so long-running scrapes appeared frozen).
- **Fix**: campaign and lead list polling (every 2s while a campaign is running) no longer flashes the whole page back to a loading skeleton on every refresh — only the initial fetch shows the skeleton, so live progress/lead updates render smoothly.
- **Fix**: lead scoring/ordering no longer ranks by raw star rating alone (a 5.0★ lead with 1 review could previously outrank a 4.5★ lead with thousands of reviews). Review count is now scraped and stored, and rating contribution to the score uses a Bayesian average (weighted toward a neutral 4.0★ prior by review volume) so low-review, high-star leads no longer unfairly beat well-reviewed ones.

---

## License

MIT — see [LICENSE](LICENSE).

---

<div align="center">
  <sub>Built with ❤️ by <a href="https://github.com/asiifdev">asiifdev</a></sub>
</div>
