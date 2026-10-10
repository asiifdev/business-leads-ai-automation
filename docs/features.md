# Features

What Prospex does today, what each part is for, and how far it has been verified. If something is not listed here as working, assume it does not exist yet.

**Status key**

| Mark | Meaning |
|------|---------|
| **Verified** | Run against the real thing (real Google Maps, real chat exports, real websites, a real database) during development. |
| **Simulated** | Tested end to end with a stand-in for an outside service (for example a fake WhatsApp). The logic is tested, the real service is not. |
| **Partial** | Works, with a limit that matters. |
| **Planned** | Not built. |

## 1. Understand your offer

| Feature | What it does and why | Where | Status |
|---------|----------------------|-------|--------|
| **Source material** | Add a website, paste text, or upload `.pdf`, `.docx`, `.md`, `.txt`. A website is read as a whole (sitemap, `llms.txt`, linked pages), not just the page you typed, so the AI does not have to guess. | New campaign, Marketing brief | Verified on real sites; PDF verified through the API; DOCX covered by tests |
| **Marketing brief** | Turns the sources into a structured brief (summary, audience, problem, what sets it apart, objections, proof, offer, voice, outreach angles). Facts must come from the sources: numbers, customers, testimonials and prices that cannot be found in them are dropped and listed as missing. Every section is editable and each save is a new version. | Marketing brief | Verified with local models. A modest model can misplace facts between sections, so review it |
| **Campaign autofill** | From the brief, fills the campaign form (name, target business type, location, search queries, service description, style, language) for you to correct. Fields you edited are never overwritten. | New campaign | Verified |
| **Knowledge base** | Everything you add as a source is also indexed (pgvector), so reply drafts can quote your facts and decline to state what is not there. | API, Marketing brief (sources) | Verified. A dedicated screen is planned |

Details: [marketing-brief.md](marketing-brief.md).

## 2. Find and rank prospects

| Feature | What it does and why | Where | Status |
|---------|----------------------|-------|--------|
| **Google Maps scraping** | Searches Google Maps for each query and area with a headless Chromium. Per business: name, address, phone, website, rating, review count, coordinates, **the real Maps category**. Progress is reported per search. Duplicates (same name and address) are removed. | Campaigns | Verified live |
| **No invented leads** | If scraping fails the campaign fails with a clear message. Prospex never fills the gap with made-up businesses. `SCRAPER_MODE=fixture` exists for tests and demos only: clearly labelled leads with no phone number. | Campaigns | Verified |
| **Lead score** | A 0 to 100 index from signals in the listing (reachable by phone, rating weighted by review count, review volume) plus an AI judgement of fit with your offer. It ranks leads, it does not predict sales. There are no hard-coded industry or city weights. | Leads | Verified |
| **Fit judgement** | For each business, the AI reads its name and real Maps category against your offer and brief, and says high, medium or low with a one-line reason. The name counts: "Rental Kamera" in a name matters even if the Maps category is generic. | Lead detail | Verified. Needs an AI provider; small local models can misjudge, which is why the reason is shown |
| **Map and list** | Leads on a map and in a table, filtered by priority and status. | Campaign detail, Leads | Verified |
| **Export** | CSV, JSON, vCard. | Campaign detail | Existing feature |

How the score is built: [architecture.md](architecture.md#lead-scoring).

## 3. Write in your own voice

| Feature | What it does and why | Where | Status |
|---------|----------------------|-------|--------|
| **AI Style** | Learns how you write from your own WhatsApp chat exports: reply length, emoji, how you open and close. Stores statistics and anonymized question and answer pairs, never the raw chats. Delete it any time. | AI Style | Verified on real exports |
| **Draft writer** | Writes first messages and follow-ups from the lead's real data, your style, the matching angle from your brief, and the facts in your knowledge base. First messages follow a fixed structure (greeting and introduction, one fact about the business, one benefit, one easy question) and carry an opt-out line. | Outbox | Verified with local models |
| **Standard spelling** | Chat habits (all lowercase, no punctuation, "gk", "yg") are not copied. Capitals, punctuation, "Halo, Kak," and decimal commas follow PUEBI, enforced after the AI writes. | Outbox | Verified |
| **Risk flags** | A draft that contains links, prices, discounts or bank details that no source supports, or a customer message that reads like an instruction to the AI, is flagged for the reviewer. | Outbox | Verified |

Details: [ai-style.md](ai-style.md).

## 4. Review, send, reply

| Feature | What it does and why | Where | Status |
|---------|----------------------|-------|--------|
| **Outbox** | Every message starts as a draft. You approve, edit or reject. Nothing is sent without approval. | Outbox | Verified |
| **WhatsApp connection** | Links a number as a device (Baileys) by QR code. Sessions survive restarts. | Outbox | QR pairing verified. Sending a real message is **not yet confirmed** |
| **Paced sending** | One message at a time: hourly and daily caps (default 10 and 80), quiet hours (default 21:00 to 07:00), random gaps, a typing indicator, a check that the number is on WhatsApp. Pause any time. | Outbox | Simulated |
| **Safety stops** | Three failures in a row pause the account. A message interrupted mid-send is marked failed and never resent automatically. A number that replies STOP (or similar) is blocked for good. | Outbox | Simulated |
| **Replies** | A reply from a known lead updates the CRM status, cancels pending follow-ups and creates a reply draft with the customer's message quoted. Unknown numbers are stored, never answered. | Outbox | Simulated |
| **Follow-ups** | Drafts after 3 and 5 days of silence, at most two. Also approved by you. | Outbox | Simulated |

Details: [whatsapp-outbox.md](whatsapp-outbox.md).

## 5. Track results

| Feature | What it does and why | Where | Status |
|---------|----------------------|-------|--------|
| **CRM pipeline** | New, contacted, replied, meeting, proposal, won, lost, with notes and a dated activity log. | Lead detail | Existing feature |
| **Analytics** | Counts of leads, campaigns, conversion and deals from your data, a trend of recent campaigns, industries. | Dashboard, Analytics | Existing feature |
| **Notifications** | Drafts waiting for review and messages that need attention (counts from the Outbox). | Header bell | Built, not exercised end to end |

## 6. Run it

| Feature | What it does | Status |
|---------|--------------|--------|
| **English and Indonesian** | Every screen, switchable in the header and on the login page. | Verified |
| **API and keys** | REST API with Swagger; API keys per workspace. | Existing feature |
| **Self-hosting** | Docker Compose for local and production (PostgreSQL with pgvector, Redis, API, web, Nginx). WhatsApp sessions on a persistent volume. | Partial: compose files validated, a full production deployment has not been exercised |
| **Any OpenAI-compatible AI** | OpenAI, OpenRouter, Ollama, or your own endpoint. Set in the server `.env`. | Verified with Ollama |

## Safety built in

- **Human approval** before every message.
- **Website reading** refuses private and internal addresses (including names that resolve to them), re-checks every redirect, limits size and time, and runs the browser behind a proxy that resolves each name once and connects to the checked address.
- **Outside text is data** in every AI prompt (web pages, customer replies, scraped listings, exported chats). Drafts are scanned afterwards.
- **No fabricated evidence**: the brief's proof is grounded in the sources, and drafts may only mention proof that is in the brief.
- **Opt-out is absolute** and checked when you approve and again when the message is sent.

## What Prospex is not (yet)

Prospex covers one part of marketing well: **finding local businesses, understanding your offer, and conversations by WhatsApp**. It is not yet a full marketing suite. Not built:

- Official WhatsApp Business Cloud API (the sender is built to accept it as a second provider).
- Email, Instagram, LinkedIn or SMS sending. Email and LinkedIn notes are generated for high-priority leads but not sent.
- Content and SEO writing, social posts and calendars, ads, landing pages, reviews and reputation, attribution beyond the CRM counters.
- Teams with several users per workspace (the Settings screen shows the current user only), workspace deletion, and per-workspace AI keys (the Settings screen stores them, the AI features read the server `.env`).
- Proposals and invoices, an agent or MCP server.

The roadmap in the [README](../README.md#roadmap) lists what is next.
