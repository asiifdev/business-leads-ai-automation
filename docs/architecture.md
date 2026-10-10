# Architecture

A map of how Prospex is put together, for people who want to change it.

## The pieces

```
 Dashboard (Next.js)  ── REST + JWT ──►  API (NestJS)  ──►  PostgreSQL 16 + pgvector
                                          │   │
                                          │   └──► Redis ── BullMQ ──► scraper worker (Playwright)
                                          │
                                          ├──► Chromium via Playwright (Google Maps scraping; JavaScript-only pages)
                                          │       └─ web pages go through SafeProxy: public addresses only
                                          ├──► AI provider (OpenAI-compatible: OpenAI, OpenRouter, Ollama)
                                          └──► WhatsApp (Baileys linked device, behind WhatsappProvider)
```

Everything is scoped to a `Workspace`. Every table that holds customer data has a `workspaceId`, and every query filters on it. Users reach a workspace through `WorkspaceMember`.

## API modules (`apps/api/src`)

| Module | Responsibility |
|--------|----------------|
| `auth`, `workspace`, `settings` | Accounts (JWT), API keys, encrypted integration secrets |
| `campaigns`, `scraper`, `leads` | Campaigns, Google Maps scraping (BullMQ worker, headless Chromium), leads and CRM state |
| `ai` | OpenAI-compatible client, lead scoring and per-business fit judgement, knowledge base (chunks and vectors), AI Style (chat-export parser, statistics, retrieval), spelling clean-up |
| `marketing` | Marketing Brief: sources (websites, text, PDF, DOCX, Markdown), safe fetching and site crawling, guarded page renderer, brief generation and grounding |
| `messaging` | Outbox, WhatsApp provider, sender, inbound handling, follow-ups, draft writer |
| `email` | Email channel: SMTP account (encrypted password), draft generation with subjects, sender with the same pacing rules, public unsubscribe page |
| `entitlements` | Edition and plan checks (community or hosted), see [editions.md](editions.md) |
| `analytics`, `export` | Reporting and CSV/JSON/vCard export |

## Marketing brief in detail

| File (`apps/api/src/marketing`) | Role |
|------|------|
| `brief.service.ts` | Sources (add website, text, file; list; remove), background site reading, brief generation in three passes, saving versions |
| `site-crawler.ts` | Reads a site as a whole: `llms.txt`, `robots.txt`, sitemaps (index files too), home-page links as a fallback; ranks pages; static fetch first, browser render when the page has almost no text; drops near-duplicate pages |
| `url-fetch.ts` | Safe fetching: http and https on ports 80 and 443, no credentials in the URL, every address checked at connection time, redirects re-validated, size and time caps, a single linear pass HTML-to-text |
| `safe-proxy.ts` | The proxy the render browser uses. It resolves a name once, refuses private and local addresses, and connects to the checked address, so DNS rebinding cannot swap in an internal one |
| `page-renderer.ts` | Headless Chromium for JavaScript-only pages: sandbox on unless `PLAYWRIGHT_NO_SANDBOX=true`, no images, video or fonts, every request checked |
| `document-text.ts` | `.md`, `.txt`, `.docx` (only `word/document.xml` is unzipped, size-checked, stripped in one pass) and `.pdf` (parsed in a worker thread that is killed on timeout and memory-limited) |
| `brief-prompt.ts`, `brief-schema.ts` | The three prompts (positioning, evidence, outreach), merging, coercion of model output, grounding of evidence, customer search-term filter |
| `brief-use.ts` | What the draft writer takes from the brief: matching angle, grounded proof, words to avoid |

Design decisions worth knowing:

- **Three small passes.** A single large JSON answer is where modest models misplace keys; each pass is retried once and a pass that still fails becomes a gap.
- **Grounding after generation.** Numbers, customer names, testimonials and prices must occur in the source text, otherwise they are removed and listed as missing.
- **The brief is a stored, versioned, editable document** (`marketing_briefs`, one per workspace). Sources keep their extracted text (`knowledge_sources.text`) so a brief can be regenerated without reading the site again.
- **Fetching is the sensitive part.** Everything that opens a user-supplied address goes through the checks above; the unit tests include hostile inputs (private addresses, names resolving to loopback, pathological HTML, XML and link lists) with time limits.

## Lead scoring

`LeadIntelligenceService` ranks leads with an index built only from the listing and one judgement:

```
30 base
+15 phone   +3 address
+5 / +10 / +15  Bayesian rating (3.5 / 4.0 / 4.5; a prior of 4.0 worth 25 reviews)
+2 / +5 / +10   reviews (5 / 20 / 100)
+20 high, +8 medium, -15 low  fit with the offer (0 when not assessed)
HIGH from 70, MEDIUM from 50
```

`FitService` judges fit per business in batches of 20, from the business name and the real Google Maps category against the offer and the brief's description of customers, and returns a reason that is shown on the lead. The scraper keeps the real Maps category on the lead and normalizes ratings (`4,6` and `4.6`). There are no industry or city tables.

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
- **No canned content, no invented leads.** When no AI provider is configured Prospex produces no draft, and when scraping fails it fails the campaign. `SCRAPER_MODE=fixture` (tests only) returns labelled leads without phone numbers.

## Email in detail

Email reuses the `outbound_messages` table with `channel = "email"` (`toEmail`, `subject`), the approval flow in `MessagingService` and the pure `send-policy.ts`. It has its own account table (`email_accounts`, password encrypted), its own opt-out table (`email_opt_outs`) and its own sender (`EmailSenderService`), so WhatsApp and email each count their own quota. Details and limits: [email-channel.md](email-channel.md).

## AI Style and knowledge base

Both use pgvector: vectors are stored in `vector` columns and compared by cosine distance. Each row records the embedding model and dimensions, and queries only compare rows from the same model. See [ai-style.md](ai-style.md).

## Frontend (`apps/web`)

Next.js App Router with route groups `(auth)` and `(dashboard)`, shadcn/ui and Tailwind. Feature components live under `src/components/<feature>`. Text is translated through `src/lib/i18n` (English is the source, Indonesian must define every key, the language is kept in a cookie so the server renders the right one).

## Testing

| Layer | How |
|-------|-----|
| Pure logic (parser, stats, chunker, scoring, send policy, opt-out, spelling, brief, crawler, documents, hostile-input timing) | `pnpm --filter @prospex/api test` |
| Sender and inbound against a real database | `apps/api/scripts/pipeline-check.ts` with a fake provider |
| Style quality | `apps/api/scripts/eval-style.ts` |
| End to end UI | Playwright specs in `tests/e2e` |

Real WhatsApp delivery cannot be tested without a linked phone, so the Baileys provider is verified by pairing manually.
