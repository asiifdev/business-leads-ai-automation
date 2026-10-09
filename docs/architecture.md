# Architecture

A map of how Prospex is put together, for people who want to change it.

## The pieces

```
 Dashboard (Next.js)  ── REST + JWT ──►  API (NestJS)  ──►  PostgreSQL 16 + pgvector
                                          │   │
                                          │   └──► Redis ── BullMQ ──► scraper worker (Playwright)
                                          │
                                          ├──► AI provider (OpenAI-compatible: OpenAI, OpenRouter, Ollama)
                                          └──► WhatsApp (Baileys linked device, behind WhatsappProvider)
```

Everything is scoped to a `Workspace`. Every table that holds customer data has a `workspaceId`, and every query filters on it. Users reach a workspace through `WorkspaceMember`.

## API modules (`apps/api/src`)

| Module | Responsibility |
|--------|----------------|
| `auth`, `workspace`, `settings` | Accounts (JWT), API keys, encrypted integration secrets |
| `campaigns`, `scraper`, `leads` | Campaigns, Google Maps scraping (BullMQ worker), leads and CRM state |
| `ai` | OpenAI-compatible client, rule-based lead scoring, knowledge base (chunks and vectors), AI Style (chat-export parser, statistics, retrieval) |
| `messaging` | Outbox, WhatsApp provider, sender, inbound handling, follow-ups, draft writer |
| `analytics`, `export` | Reporting and CSV/JSON/vCard export |

## Messaging in detail

| File | Role |
|------|------|
| `message-writer.service.ts` | Writes first messages, follow-ups and replies. Combines lead data, style, retrieved examples and knowledge. Rejects output with template placeholders. Returns risk flags. |
| `messaging.service.ts` | Outbox operations (generate in the background, edit, approve, reject, cancel, retry), account settings, overview |
| `sender.service.ts` | 15-second loop: applies the send policy, claims a message atomically, sends, handles failures, trips the circuit breaker |
| `send-policy.ts` | Pure functions: `decide`, `nextGapMs`, `typingDelayMs`, quiet hours, local-day boundaries. Unit tested. |
| `inbound.service.ts` | Stores replies, honours STOP, updates leads, cancels follow-ups, creates reply drafts |
| `followup.service.ts` | Hourly: drafts follow-ups after 3 and 5 days of silence, at most two |
| `whatsapp.provider.ts` | The interface the rest of the code depends on |
| `baileys.provider.ts` | Linked-device implementation: pairing QR, reconnect with backoff, session files, inbound events |
| `phone.ts`, `opt-out.ts`, `draft-risk.ts` | Phone normalization, STOP and injection detection, output risk checks |

### Data model (messaging)

| Table | Purpose |
|-------|---------|
| `whatsapp_accounts` | One per workspace: status, limits, quiet hours, timezone, pause flag, next allowed send time |
| `outbound_messages` | The queue and the history: body, the original AI text (`aiBody`, to measure edits), source, status, context (trace, flags), provider id |
| `inbound_messages` | Replies, unique per workspace and provider message id (so redelivery is ignored) |
| `message_opt_outs` | Numbers that must never be contacted, unique per workspace and number |

`leads.phoneE164` stores the normalized number so replies can be matched to leads. Leads created before this column existed are backfilled at startup.

### Design decisions worth knowing

- **Approval is the only way into the queue.** No code path sends a draft.
- **Claim, then send.** `updateMany where status = approved` guarantees one winner, so a crash or a second process cannot double-send.
- **Uncertain means failed, not retried.** A message found in `sending` after a restart might have been delivered. Prospex chooses a missed send over a duplicate.
- **One provider interface.** The official WhatsApp Cloud API is a new class, not a rewrite.
- **Untrusted text stays data.** Scraped listings, customer replies and exported chats are delimited in prompts, and the model's output is scanned before you see it.
- **No canned content.** When no AI provider is configured, Prospex produces no draft rather than a template that looks real.

## AI Style and knowledge base

Both use pgvector: vectors are stored in `vector` columns and compared by cosine distance. Each row records the embedding model and dimensions, and queries only compare rows from the same model. See [ai-style.md](ai-style.md).

## Frontend (`apps/web`)

Next.js App Router with route groups `(auth)` and `(dashboard)`, shadcn/ui and Tailwind. Feature components live under `src/components/<feature>`. Text is translated through `src/lib/i18n` (English is the source, Indonesian must define every key, the language is kept in a cookie so the server renders the right one).

## Testing

| Layer | How |
|-------|-----|
| Pure logic (parser, stats, chunker, send policy, opt-out, draft risk) | `pnpm --filter @prospex/api test` |
| Sender and inbound against a real database | `apps/api/scripts/pipeline-check.ts` with a fake provider |
| Style quality | `apps/api/scripts/eval-style.ts` |
| End to end UI | Playwright specs in `tests/e2e` |

Real WhatsApp delivery cannot be tested without a linked phone, so the Baileys provider is verified by pairing manually.
