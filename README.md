<div align="center">
  <h1>Prospex</h1>
  <p><strong>Open-source outreach for selling to local businesses.</strong></p>
  <p>Find businesses on Google Maps, let AI draft the first message in your own voice, approve it, and send it on WhatsApp one message at a time.</p>
  <p><a href="https://alatpintar.id">Hosted version</a> · <a href="#quickstart">Self-host</a> · <a href="docs/whatsapp-outbox.md">How sending works</a> · <a href="#roadmap">Roadmap</a> · <a href="COMMERCIAL-LICENSE.md">Commercial license</a></p>

  [![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
  [![GitHub stars](https://img.shields.io/github/stars/asiifdev/business-leads-ai-automation?style=social)](https://github.com/asiifdev/business-leads-ai-automation/stargazers)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
  [![NestJS](https://img.shields.io/badge/NestJS-10-red.svg)](https://nestjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
</div>

<p align="center">
  <img src="docs/screenshots/outbox.png" alt="Prospex Outbox: AI drafts waiting for review, each with Approve, Edit and Reject" width="860">
</p>

## Why Prospex exists

Selling to local businesses means hundreds of first messages and just as many follow-ups. Most tools either hide the work behind a bulk sender that gets numbers banned, or leave you to write everything yourself.

Prospex splits the job in two. The AI does the typing: it finds the leads, writes each draft, and drafts the replies and follow-ups. You do the deciding: every message waits in your Outbox until you approve it, and approved messages leave at a pace you set, one at a time.

> **Prefer not to run servers?** The hosted version at **[alatpintar.id](https://alatpintar.id)** runs Prospex for you. Self-hosting is free under the AGPL.

If Prospex is useful to you, a star helps other people find it.

## What you can do with it

| Step | What happens |
|------|--------------|
| **Find** | Scrape Google Maps by industry and city, with progress per search area and a map of the results. |
| **Score** | Each lead gets a 0 to 100 score from data completeness, rating (weighted by review count), industry and location, with a bonus when the business has no website. Scoring is rule-based, so it works without any AI key. |
| **Draft** | The AI writes the first message from the lead's real data (rating, reviews, no website) and your own style. If your knowledge base has the answer, it uses that. If not, it does not quote a price. |
| **Approve** | Read, edit, approve or reject each draft in the Outbox. Nothing is sent before this step. |
| **Send** | Approved messages go out through WhatsApp one at a time: hourly and daily caps, quiet hours, random gaps, and a typing indicator before each one. |
| **Reply and follow up** | A reply updates the lead, cancels pending follow-ups, and creates a reply draft for you. Leads that stay silent get up to two follow-up drafts, after 3 and 5 days. A recipient who writes STOP is never contacted again. |

### Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/ai-style.png" alt="AI Style page showing a learned writing profile"><br><sub><b>AI Style.</b> The voice learned from your own chat exports: reply length, emoji, punctuation, openers.</sub></td>
    <td width="50%"><img src="docs/screenshots/leads.png" alt="Leads table sorted by score"><br><sub><b>Leads.</b> Scored and filterable, with CRM status per lead.</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="docs/screenshots/dashboard.png" alt="Dashboard with lead and campaign totals"><br><sub><b>Dashboard.</b> Leads, campaigns and conversion at a glance. The data in these screenshots is fictional demo data.</sub></td>
  </tr>
</table>

## Writing in your own voice

AI Style is optional. If you use it, you export a few of your own WhatsApp chats (WhatsApp's official **Export chat** feature, `.txt` or `.zip`) and pick which participant is you. Prospex then:

- measures how you write: reply length, emoji, punctuation, how you open and close;
- stores anonymized pairs of *what the customer wrote* and *how you answered*, so it can show the model your real replies to similar questions;
- never stores the raw chats. Phone numbers, emails and links are replaced before anything is saved.

It is retrieval, not model training, so you can delete the profile at any time and nothing remains in a model. Everything can run on your machine with Ollama. [How it works, what it costs and how well it did in testing](docs/ai-style.md).

## Sending that protects your number

WhatsApp bans numbers that behave like bulk senders. Prospex is built around not behaving like one:

| Safeguard | Default |
|-----------|---------|
| Human approval before every message | Always on |
| Messages per hour | 10 (configurable 1 to 30) |
| Messages per day | 80 (configurable) |
| Quiet hours | 21:00 to 07:00 in your timezone |
| Gap between messages | Random, 0.6x to 1.4x of the hourly average |
| Typing indicator | Shown before each message, scaled to its length |
| Number check | Skips numbers that are not on WhatsApp, without counting them as failures |
| STOP handling | Cancels pending messages and blocks the number permanently |
| Opt-out line | Added to every first message and follow-up |
| Circuit breaker | Pauses sending after 3 failures in a row |
| Crash safety | A message interrupted mid-send is marked failed, never resent automatically |

Pace decides the calendar. At the defaults (10 per hour, 80 per day) a list of 1,500 leads takes about 19 days. Raising the daily cap to 140, the most that 10 per hour allows between 07:00 and 21:00, shortens it to about 11 days. Start with a batch of 30 to 50 leads, watch the reply rate and the account, then scale up. Details and the reasoning are in [docs/whatsapp-outbox.md](docs/whatsapp-outbox.md).

**Two ways to connect WhatsApp.** Today Prospex connects as a linked device (Baileys), which works with any number but is unofficial, so use a dedicated business number. An adapter for the official WhatsApp Business Cloud API is planned; the sender already talks to WhatsApp through one provider interface, so adding it does not change the queue. The hosted version will offer both.

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16 (App Router), shadcn/ui, Tailwind CSS, Recharts, English and Indonesian interface |
| **Backend** | NestJS 10, Prisma ORM, REST API with Swagger |
| **Database** | PostgreSQL 16 with pgvector |
| **Queue** | BullMQ and Redis 7 for scraping jobs |
| **AI** | Any OpenAI-compatible provider: OpenAI, OpenRouter, Ollama |
| **WhatsApp** | Baileys (linked device) |
| **Monorepo** | Turborepo and pnpm workspaces |

<a id="quickstart"></a>
## Quickstart

You need [Node.js 20+](https://nodejs.org/), [pnpm 9+](https://pnpm.io/) and [Docker](https://www.docker.com/).

```bash
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation
pnpm install

cp .env.example apps/api/.env
cp .env.example packages/database/.env
# edit apps/api/.env: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, OPENAI_*

docker compose up -d                       # PostgreSQL 16 with pgvector, and Redis
pnpm --filter @prospex/database db:deploy  # apply migrations
pnpm --filter @prospex/database exec prisma generate

pnpm --filter @prospex/api dev             # API on :3001
pnpm --filter @prospex/web dev             # dashboard on :3000
```

Open [http://localhost:3000](http://localhost:3000), register, and create your first campaign. Swagger lives at [http://localhost:3001/api/docs](http://localhost:3001/api/docs).

Your first outreach, step by step:

1. **Campaigns**: create a campaign (industry, city, what you sell) and start it.
2. **AI Style** (optional): import a few of your WhatsApp chat exports.
3. **Outbox**: click **Connect WhatsApp** and scan the code with the phone (WhatsApp, Linked devices).
4. **Outbox, Review**: choose the campaign, click **Write drafts**, then approve what you like.

The full walkthrough is in [docs/USER_GUIDE.md](docs/USER_GUIDE.md) (Indonesian).

### Choosing an AI provider

Any OpenAI-compatible endpoint works. Drafts need a chat model, and the style and knowledge features need an embedding model (`EMBEDDING_MODEL`). Switching the embedding model later means re-importing your chats and re-indexing your sources, because vectors from different models cannot be compared.

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small

# OpenRouter
OPENAI_API_KEY=sk-or-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-haiku-4-5

# Ollama, fully local
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=gemma4
EMBEDDING_MODEL=qwen3-embedding
```

With `OPENAI_API_KEY` empty, scraping and rule-based scoring still work, and the AI features (drafts, AI Style, knowledge base) are off. Prospex does not fill the gap with canned text. A local model can take around 40 seconds per draft, so drafting runs in the background and the Outbox shows progress.

### WhatsApp settings

| Variable | Default | Purpose |
|----------|---------|---------|
| `WA_AUTH_DIR` | `./.wa-auth` | Where linked-device sessions are stored. Mount it as a volume in production and treat it like a password. |
| `WHATSAPP_DISABLED` | `false` | Set to `true` to turn off the sender, WhatsApp connections and follow-up scheduling (used in CI). |

## Production

```bash
cp .env.example .env     # strong passwords, real API keys
docker compose -f docker-compose.prod.yml up -d
```

This starts PostgreSQL with pgvector, Redis, the API, the dashboard and Nginx. Keep `WA_AUTH_DIR` on a persistent volume, otherwise every redeploy asks you to scan the code again.

## Project structure

```
prospex/
├── apps/
│   ├── api/              # NestJS API: scraper, leads, ai, messaging, auth
│   ├── web/              # Next.js dashboard (EN/ID)
│   └── marketing/        # Landing page
├── packages/
│   ├── database/         # Prisma schema and migrations
│   ├── types/            # Shared TypeScript types
│   └── config/           # Shared eslint and tsconfig
├── docs/                 # Guides, architecture, screenshots
└── docker-compose*.yml   # Local and production stacks
```

How the modules fit together: [docs/architecture.md](docs/architecture.md).

## API

Interactive docs at `/api/docs`. The main routes:

| Area | Endpoints |
|------|-----------|
| **Campaigns and scraping** | `GET/POST /api/campaigns`, `POST /api/scraper/campaigns/:id/start` |
| **Leads and CRM** | `GET /api/leads`, `PATCH /api/leads/:id/crm`, `GET /api/analytics` |
| **Export** | `GET /api/export/leads/{csv,json,vcard}` |
| **AI Style** | `POST /api/style/inspect`, `POST /api/style/train`, `GET/DELETE /api/style/profile`, `POST /api/style/draft` |
| **Knowledge base** | `GET/POST /api/knowledge/sources`, `DELETE /api/knowledge/sources/:id`, `POST /api/knowledge/search` |
| **Outbox** | `GET /api/messaging/outbox`, `POST /api/messaging/outbox/generate`, `POST .../approve`, `.../reject`, `.../cancel`, `PATCH .../:id`, `POST .../:id/retry` |
| **WhatsApp** | `GET /api/messaging/whatsapp`, `POST .../connect`, `POST .../disconnect`, `PATCH .../settings` |
| **Settings** | `GET/POST/DELETE /api/settings/api-keys`, `GET/POST /api/settings/integrations` |

## Development

```bash
pnpm install
pnpm --filter @prospex/api exec tsc --noEmit    # typecheck API
pnpm --filter @prospex/web exec tsc --noEmit    # typecheck web
pnpm --filter @prospex/api test                 # unit tests (parser, style stats, send policy, opt-out, draft risk)
pnpm --filter @prospex/database db:studio       # Prisma Studio
```

`apps/api/scripts/pipeline-check.ts` exercises the sender and inbound handling against a real database with a fake WhatsApp provider. `apps/api/scripts/eval-style.ts` compares generic drafts with drafts in your style on your own exports. See [CONTRIBUTING.md](CONTRIBUTING.md).

<a id="roadmap"></a>
## Roadmap

Done:

- [x] Google Maps discovery, scoring, CRM pipeline, analytics, export
- [x] Knowledge base with retrieval (pgvector), through the API
- [x] AI Style: learn your voice from WhatsApp exports
- [x] Outbox: approve, edit, reject, then send one at a time with limits
- [x] WhatsApp through Baileys: pairing, replies as drafts, STOP handling, follow-up drafts
- [x] English and Indonesian interface (navigation, AI Style and Outbox translated so far)

Next:

- [ ] Official WhatsApp Business Cloud API provider
- [ ] Knowledge base screen (today it is API only)
- [ ] Per-workspace AI provider keys for the AI features (the Settings screen stores them encrypted today, but drafts, AI Style and the knowledge base read the server `.env`)
- [ ] Translate the remaining screens to Indonesian
- [ ] Edit-rate and reply-rate dashboard, to see whether drafts are improving
- [ ] Function-calling agent and MCP server, so AI agents can work your pipeline
- [ ] Proposals and invoices

Open an issue to vote on what comes next.

## License

Prospex is licensed under the **GNU AGPL-3.0-or-later**, see [LICENSE](LICENSE). Self-hosting and modifying are free. If you offer a modified version as a network service, you must publish your changes. A [commercial license](COMMERCIAL-LICENSE.md) is available if the AGPL does not fit your use.

Scraping websites and messaging people are regulated by the terms of those services and by privacy and anti-spam laws (GDPR, Indonesia's UU PDP and others). You are responsible for how you use this software. Read [DISCLAIMER.md](DISCLAIMER.md) before you contact anyone.

---

<div align="center">
  <sub>Built by <a href="https://github.com/asiifdev">asiifdev</a></sub>
</div>
