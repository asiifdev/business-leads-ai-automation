# Changelog

## Unreleased (edition work)

- Added `EDITION` and an entitlements service; `GET /entitlements`; 402 `UPGRADE_REQUIRED`.
- Added a per-workspace WhatsApp gateway and a connection-type choice in Outbox settings. The official API option is locked outside hosted plans.
- Fixed: a group message could be attributed to a private number; only private chats now yield one.
- Added contact enrichment: emails, WhatsApp numbers and profiles read from each lead's own website (including `wa.me/<username>` pages), automatic after a scrape, with a browser fallback.
- Added the email channel (SMTP, approval flow, pacing, unsubscribe link and headers): docs/email-channel.md. Replies are not read yet.
- Fixed: WhatsApp counts, queue and follow-ups now filter by channel so email rows cannot be sent over WhatsApp.
- Added docs/editions.md. The official connector is not built.

## Unreleased (2026-10)

### Added
- **Outbox.** Every message starts as a draft and is sent only after you approve it. Review, Queue, Sent and Needs attention tabs; edit before approving; bulk approve with a confirmation step.
- **WhatsApp (Baileys).** Pairing from the dashboard, automatic reconnect, resumed sessions after restart. Sending one message at a time with hourly and daily caps, quiet hours, random gaps, typing indicator, number check, circuit breaker and crash-safe claiming.
- **Replies and STOP.** Incoming messages are matched to leads, update the CRM status, cancel pending follow-ups and create reply drafts. STOP and similar words permanently block a number.
- **Follow-up drafts.** Up to two per silent lead, after 3 and 5 days.
- **AI Style.** Learn your writing voice from WhatsApp chat exports (statistics plus retrieval of your real replies, no raw chats stored). Test page with a full trace of how each draft was made.
- **Knowledge base API** with retrieval on pgvector, used to ground drafts.
- **Draft writer** that uses the lead's real data, your style and your knowledge base, and flags drafts that contain unsupported links, prices, discounts or bank details.
- **English and Indonesian interface** on every screen, switchable in the header and on the login and register pages. The language is kept in a cookie so the server renders it.
- PostgreSQL image is now `pgvector/pgvector:pg16`. License is AGPL-3.0-or-later with a commercial option.

### Changed
- **First messages follow a sales structure**: greeting and introduction ("Halo, Kak, perkenalkan saya dari tim ..."), one specific fact with its number (rating, reviews, no website), one concrete benefit, one easy-to-answer question. Hedging words and jargon ("mungkin tertarik", "digitalisasi", "terstruktur") are banned in the prompt.
- **Standard Indonesian spelling (PUEBI) is enforced on every draft** after generation, instead of imitating lowercase and unpunctuated chat habits. Time-of-day greetings are replaced by "Halo".
- AI Style: attachment markers in front of captions ("IMG-...jpg (file attached)") no longer count as words (they showed up as the owner's most common opener). Re-import your chats to refresh an existing profile.
- Header notifications now show real counts (drafts waiting for review, messages that failed) instead of hard-coded sample entries.
- Settings: the team list shows the signed-in user instead of a fixed "Admin" entry, and the "Delete workspace" and "Invite team member" buttons are disabled because neither is implemented yet. The AI key help text now says the AI features read the server `.env`.
- Lead activity log: status changes are rendered from structured data, so they appear in the interface language (previously the server wrote English text).
- Dashboard: the trend chart badge says "Last 6 campaigns", which is what it plots.
- Lead outreach text is no longer generated at scrape time. WhatsApp and Instagram messages come from the draft writer and wait for approval; email, LinkedIn and call notes are still generated when an AI provider is configured.
- Sidebar: fixed a 5px overflow caused by long workspace names, unified the active-item style, removed the stale "New" badge.
- AI Style page redesigned.

### Fixed
- **Replies were silently dropped** when WhatsApp addressed the chat with an opaque `@lid` identifier instead of a phone number. The number is now read from `senderPn`. Found by sending a real test message and replying to it.
- Manual one-off messages: `POST /api/messaging/outbox/manual` creates a draft (still needs approval).
- **The page could scroll as a whole** (and "stick") because an invisible file input escaped the scroll area. The main area is now the containing block.
- **Scraper no longer invents businesses.** When scraping failed (for example the browser was not installed) it used to generate fake companies with made-up phone numbers and websites and list them as real leads. It now fails the campaign with a clear message. `SCRAPER_MODE=fixture` (tests and demos only) returns clearly labelled test leads without phone numbers. `apps/api/scripts/find-mock-leads.ts` finds and marks leftovers from the old behaviour in an existing database.
- **Ratings in Indonesian format were misread** (`4,6` was parsed as 4). Ratings are normalized when scraped and when scored.
- **Leads now carry the real Google Maps category** ("Toko Kamera") instead of a label chosen by the campaign.
- **Lead scores no longer use made-up weights.** The hard-coded industry and city tables are gone. The score uses listing signals (phone, rating, review volume) plus an AI judgement of how well each business (name and real Maps category) fits your offer and Marketing Brief, with the reason shown.

### Added (campaign form and brief)
- **New campaign form**: source material first (website, text, `.pdf`, `.docx`, `.md`, `.txt`), then an AI-filled form for you to correct. Fields you typed are never overwritten, AI-filled fields are marked, and what the sources did not settle is listed.
- **Marketing brief page** with every section editable and versioned. The brief now also feeds the draft writer (matching angle, grounded proof, words to avoid).
- Campaign detail shows the campaign's setup (offer, queries, style, language, dates) and links to the Outbox for that campaign.
- **Target business type is free text** instead of a fixed list of 11 industries, which did not match Google Maps categories.

### Added (marketing brief)
- **Marketing Brief**: sources (websites, pasted text, `.md` and `.txt` files) become a structured product-marketing brief following the `product-marketing` skill, written in three small passes. Evidence (customers, numbers, prices, testimonials) must appear in the sources or it is dropped and listed as `[NEED: ...]`.
- **Website reading** follows `llms.txt`, `sitemap.xml`, `robots.txt` and home-page links (up to 10 pages), renders JavaScript-only pages in the same Chromium that scrapes Maps, and guards every request against private addresses (SSRF).
- `OPENAI_REASONING_EFFORT=none` switches off the thinking phase of local reasoning models (about 10x faster for these tasks).

### Removed
- The built-in mock content. With no AI provider configured, Prospex now produces no draft instead of a canned message that looks real.

### Security
- Website reading refuses private addresses (including names that resolve to them), re-checks redirects, and runs the browser behind a proxy that connects only to checked addresses; the Chromium sandbox is on by default.
- HTML, XML, link and document parsing is linear and capped; PDF parsing runs in a killable worker thread.
- Uploads limited to 8 files per request and rate limited.
- Customer messages, scraped listings and exported chats are delimited in prompts and treated as untrusted data; drafts are scanned for risky content before review.

## 2026-07-29

- **Fix**: search queries combine each campaign's search term with every area in its `location` field (split on commas) before scraping. Previously `location` was stored but never sent to the scraper.
- **Feature**: leads capture `lat` and `lng` from the scraped Google Maps place URL.
- **Feature**: campaign detail has a "Map" tab with a Leaflet lead map (priority-colored markers, auto-fit bounds, popups linking to lead detail).
- **Fix**: scraping progress is reported per search query and area, so long scrapes no longer look frozen at 0%.
- **Fix**: list polling no longer flashes the page back to a loading skeleton on every refresh.
- **Fix**: lead scoring no longer ranks by raw star rating alone. Review count is stored and the rating uses a Bayesian average, so a 5.0 with one review no longer beats a 4.5 with thousands.
