# Changelog

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
- Header notifications now show real counts (drafts waiting for review, messages that failed) instead of hard-coded sample entries.
- Settings: the team list shows the signed-in user instead of a fixed "Admin" entry, and the "Delete workspace" and "Invite team member" buttons are disabled because neither is implemented yet. The AI key help text now says the AI features read the server `.env`.
- Dashboard: the trend chart badge says "Last 6 campaigns", which is what it plots.
- Lead outreach text is no longer generated at scrape time. WhatsApp and Instagram messages come from the draft writer and wait for approval; email, LinkedIn and call notes are still generated when an AI provider is configured.
- Sidebar: fixed a 5px overflow caused by long workspace names, unified the active-item style, removed the stale "New" badge.
- AI Style page redesigned.

### Removed
- The built-in mock content. With no AI provider configured, Prospex now produces no draft instead of a canned message that looks real.

### Security
- Uploads limited to 8 files per request and rate limited.
- Customer messages, scraped listings and exported chats are delimited in prompts and treated as untrusted data; drafts are scanned for risky content before review.

## 2026-07-29

- **Fix**: search queries combine each campaign's search term with every area in its `location` field (split on commas) before scraping. Previously `location` was stored but never sent to the scraper.
- **Feature**: leads capture `lat` and `lng` from the scraped Google Maps place URL.
- **Feature**: campaign detail has a "Map" tab with a Leaflet lead map (priority-colored markers, auto-fit bounds, popups linking to lead detail).
- **Fix**: scraping progress is reported per search query and area, so long scrapes no longer look frozen at 0%.
- **Fix**: list polling no longer flashes the page back to a loading skeleton on every refresh.
- **Fix**: lead scoring no longer ranks by raw star rating alone. Review count is stored and the rating uses a Bayesian average, so a 5.0 with one review no longer beats a 4.5 with thousands.
