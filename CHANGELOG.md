# Changelog

## Unreleased (2026-10-14)

### Added
- **Overture Maps as a lead source** (free, open place data read with DuckDB, no key): finds many small businesses that only have a Facebook page, most with a phone. Business types (about 50, in Indonesian and English) map to Overture categories, or type `category=camera_store`; other terms are searched in business names. The first search after the server starts takes several minutes (292 seconds in our test), later ones seconds; `OVERTURE_PLACES_URL` points at a local copy. Settings: `OVERTURE_DISABLED`, `OVERTURE_RELEASE`, `OVERTURE_PLACES_URL`, `OVERTURE_MIN_CONFIDENCE`, `OVERTURE_MEMORY_LIMIT`. DuckDB is loaded only when the source is used.
- **Paste a list of websites** into a campaign (`POST /scraper/campaigns/:id/import/websites`, "Websites" tab of the import dialog): up to 200 websites or Instagram/Facebook pages; each is opened for the business's name and details, pages that cannot be opened or are parked are named in the campaign's note and left out, and the leads go through the usual steps.
- `docs/lead-sources.md`: every source, its cost and terms, and the directories and marketplaces that were reviewed and **not** built (IndonesiaYP and Tokopedia forbid automated access).
- `apps/api/scripts/overture-check.ts` reads real places through DuckDB.
- **Business details from the lead's own website.** Enrichment now also keeps what the site states about itself: description, type, opening hours, address and price range (schema.org data and meta tags), shown on the lead page and given to the draft writer as background inside the untrusted-data block. A mobile number or email in the site's structured data fills an empty field (with its source); a landline does not, and template emails such as info@example.com are dropped (this also applies to addresses found in structured data).
- **Leads without a website can be read too.** An Instagram or Facebook page (given as the lead's website, or listed by OpenStreetMap through `contact:instagram` and `contact:facebook`, which also count as a way to reach a place) is read through its public preview: the name and the bio, and the phone numbers and emails written there. One request per page, no posts or followers. A login wall is reported as unreachable. TikTok and link pages are not read.
- **Refresh old data** (`POST /leads/enrich/stale`, button on the Leads page): reads again the website or page of every lead that was never read or not for 90 days, 50 at a time, oldest first, and says how many are left. Campaign enrichment ("Find contacts") uses the same rule.
- `apps/api/scripts/enrichment-check.ts` verifies it against a real database (and, with `LIVE=true`, the real Instagram and Facebook pages).
- **More lead sources.** A campaign chooses where to look (`sources`: `google_maps`, `osm`), in order; later sources fill what earlier ones left of the target and the same business found twice becomes one lead with the gaps filled and each field's source recorded. **OpenStreetMap** (free, no key) finds businesses that are not on Google Maps: only named places with a phone, website or email, with category, address and coordinates, no ratings. About 50 business types are known by their Indonesian and English names, or type a tag such as `shop=camera`. Attribution is shown on the lead page. `OVERPASS_URL` and `OVERPASS_DISABLED` configure it; it also needs `GEOCODER_DISABLED` off. A source that fails is shown as a note on the campaign while another delivers, and the campaign's message (`error`) is now displayed (it was stored but never shown).
- **Import a CSV or Excel file** into any campaign (`POST /scraper/campaigns/:id/import/preview` and `/import`, "Import file" on the campaign page): columns found from English or Indonesian headings, a sample and a report before importing, a column choice you can correct, up to 2,000 rows and 5 MB. Bad values are left out and counted, and the leads then go through the same fit, score, repeat check, data-quality rating and enrichment as scraped ones. A second import adds to the campaign.
- `apps/api/scripts/sources-check.ts` verifies sources and import end to end against a running API.
- **Data trust before drafting.** Every lead now carries where each field came from (`fieldMeta`), the result of free checks (`validation`), a `dataQuality` of high, medium or low with the reasons (`qualityIssues`), the listing's open/closed status (`businessStatus`) and, for a repeat, the earlier lead it repeats (`duplicateOfId`). Nothing paid is used: DNS for e-mail domains, the page already fetched for the website, and your own WhatsApp connection for numbers.
  - **Duplicates across campaigns.** A new lead is compared with the workspace's earlier leads by phone, website domain (profile pages and marketplaces never count), then name plus place (150 m; two numbers under one name are separate branches). A repeat is kept but marked and left out of drafting.
  - **Closed businesses.** "Permanently closed" and "temporarily closed" on a Maps card are recorded; permanently closed leads are left out of drafting.
  - **Bulk drafting skips what would be wasted.** Leads rated low (closed, duplicate, no contact) are skipped, a number that WhatsApp says does not exist is skipped before the AI is called (the answer is saved for 30 days; if WhatsApp is not connected the draft goes ahead), and an e-mail whose domain does not exist is skipped. The Outbox says how many were left out and why.
  - **Draft flags.** Problems that do not stop a draft (data older than 90 days, website unreachable or parked, temporarily closed, e-mail domain invalid) appear as risk flags on the draft.
  - **Leads can be filtered by data quality** (`GET /leads?quality=high|medium|low`, also on the map feed), a badge shows on medium and low leads in the list, and "Recheck data" (`POST /leads/quality/recompute`) rates every lead again, marks repeats among leads saved earlier (the earliest is the original) and fills in where their fields came from. Running it twice changes nothing.
  - **Old data is read again.** Before bulk drafting, a lead whose website was never read or not for 90 days is read again; "Find contacts" on a campaign now also covers leads read more than 90 days ago. A WhatsApp or e-mail check counts as having looked at the lead again.
  - Repeats inside one scrape batch are marked too, and deleting the original lead (or its campaign) frees its repeats.
  - **Lead page** shows a "Data quality" card with the level and each reason. Contact enrichment now also records whether the website is live or parked and whether the e-mail domain can receive mail.
- **Leads: every lead is reachable.** The Leads page and a campaign's lead list are paged ("Page 1 of 17"), the title shows the real total, and the map loads every lead with coordinates (`GET /leads/map`, up to 5,000) instead of the first 50. The campaign "Filter" button that did nothing is now a search box.
- **Search by address, phone, website, email, category and area.** Typing "0812" also matches numbers stored as 62812.
- **Province, city/regency and district.** Worked out from each lead's coordinates (OpenStreetMap Nominatim, 1 request a second, nearby leads share one lookup) in the background after a scrape or from the "Classify area of N leads" button (`POST /leads/geo/backfill`, `GET /leads/regions`); filters on the Leads page. Set `GEOCODER_URL` to your own Nominatim to go faster, `GEOCODER_DISABLED=true` to turn it off.
- **WhatsApp attachments and link previews.** Upload a file (PDF, JPG, PNG, WebP, MP4, DOCX, XLSX, PPTX, up to 16 MB; type read from the file's own bytes) and send it with the message text as its caption, in single messages and in "One message for many leads". A link in the message gets a preview card (title, description, picture) built through the safe fetcher, shown before you approve and on by default when a link is present. A text longer than a caption (1,024 characters) goes out right after the file. Email is unchanged. Deleting a file is refused while a waiting message uses it, and a missing file fails the message instead of sending the text alone.
- **WhatsApp formatting.** Drafts keep `*bold*`, `_italic_`, `~strike~`, `- ` lists and paragraph spacing (they used to be stripped), and the Outbox shows each message as a WhatsApp bubble: file or link card on top, text under it, the opt-out line as a footnote.
- **Pipeline lists show the real count** ("Showing the oldest 50 of 312") and the one-message-for-many-leads picker says when it is cut.
- **Your own phone messages are recorded.** What you type to a lead from your phone or WhatsApp Web is stored (only for numbers that belong to a lead; any other chat is ignored), the lead stops "waiting for an answer", drafts written for something you already answered are withdrawn, later drafts know what you said, and these messages count toward neither the sending limits nor the follow-up clock. Shown as "From your phone" in the Outbox and in the lead's activity log.
- **"Interested" is a stage** (between Replied and Meeting), so it shows in the pipeline chart and the lead filters, and **"Waiting on them"** lists warm leads you answered last who have been silent for 3 days (a reminder, no automatic draft).
- **Re-read conversations** on the Pipeline page (`POST /messaging/reclassify`): a preview of what would change, then apply. Corrects labels and who is waiting, moves stages only forward, withdraws outdated drafts and writes a fresh one where an answer is still owed.
- **Pointed to another contact** is its own kind of reply: a fixed thank-you chosen in code (or a request for the number), the contact kept on the lead, and an "Add as a lead" button (`POST /leads/:id/referral`) that never adds the same number twice. Shared contact cards and photo or document captions are now read instead of dropped.
- `scripts/reclassify-replies.ts` (dry run by default) fixes replies that were labelled wrongly; `scripts/attachment-check.ts` proves attachments end to end against a real database; `scripts/pipeline-check.ts` now also covers your own phone messages, outdated drafts, re-reading the pipeline and referrals.
- `ATTACHMENTS_DIR` (with a volume in `docker-compose.prod.yml`), `GEOCODER_URL`, `GEOCODER_USER_AGENT`, `GEOCODER_DISABLED`, `REPLY_DRAFT_DELAY_MS`.

### Changed
- Fetching a page can now read only its head (`headOnly`), so a large profile page is not refused for its size.
- A campaign's totals (leads, priority, high quality, average score) are counted from the leads it holds, so a second run or an import adds to them instead of replacing them. A new run or a finished one replaces the campaign's last message instead of keeping an old failure.
- The "No website listed on Google Maps" scoring factor now reads "No website listed", because leads can come from other sources.
- **First messages for a service (an agency selling custom work).** The offer is read as a product or a service. A service intro introduces the company, names its whole range of work in plain words, and invites a conversation; it never offers a demo or says "we have an app". No character limit: length is the writer's call, and a first WhatsApp message always greets "Halo, Kak." and never "Bapak/Ibu" or "Anda". Checks in code reject questions without a question word, slang, jargon, a missing introduction and case studies from the brief; a failing draft is written again with the reasons.
- **Replies read the whole conversation.** Fact and example search uses our last message together with theirs; bubbles written together are answered together; a second reading checks that the draft is complete, answers them and invents nothing. A yes to an offered demo or call is a meeting (only what we last asked counts, not words earlier in the message such as a pitch about "schedules"); a shop's bot connecting us to its team is an automatic message, and the model is told that closing courtesies are "other" and that "pointed to another contact" means they asked us to contact someone; "boleh", "bisa dishare", "kirim contohnya" and similar are interest; "mahal", "nego" and an amount quoted from another tool are price talk.
- **A draft is written a few seconds after the prospect's last bubble** (20 seconds by default) and **replaces any older waiting draft**. Before, a new message produced no draft while an old one was still waiting, so an old draft for an old message could sit next to a newer conversation. A draft is skipped when you have already answered.
- Drafts no longer name another kind of business (the brief's list of examples, such as "kebaya", counts as foreign to a costume-hire shop).

### Fixed
- **A stage the classifier gave by mistake could never be corrected.** An old reading took "jadwal" or "CALL" for a meeting, and because stages only move forward the lead stayed in "Meeting". Re-reading the pipeline now works out the highest stage a conversation honestly reached (each of their bubbles read against what we had just asked) and lowers a stage that was given automatically; a stage the owner set by hand is never lowered.
- **Polite closings were counted as "waiting for your answer"** ("Ok kk", "makasih ka", "baik, sama-sama kak"). They are now their own kind of reply ("ack"): the lead has replied, nobody has to answer, nothing is drafted.
- **A conversation that went on with answers Prospex never saw** (typed on the phone before they were recorded) is left exactly as it is and reported as "incomplete", instead of being guessed at from half of it. Each row in "Waiting for your answer" has an "I answered" button for those.
- **A STOP typed inside a sentence never blocked the number.** Opt-out only recognised STOP at the start of a message, so "Maaf kak belum ya STOP" (the natural answer to our own "balas STOP" line) was ignored. A short message (up to 80 characters) containing STOP, "berhenti", "unsubscribe" or "jangan ganggu" is now an opt-out, and re-reading the pipeline blocks numbers that asked earlier.
- **Shop greeting bots were counted as replies** ("Thank you for your message… chat nanti dibalas", "apa yang bisa saya bantu?", catalogues, booking forms), which inflated the "Replied" stage. More of them are recognised, and re-reading the pipeline sends a lead whose only replies were automatic messages back to "contacted".
- Re-reading the pipeline never overwrites a specific label with "other".
- "Coba ka seperti apa" (show me) is read as interest.
- Re-reading the pipeline gave a lead the owner had already answered the label "other", because "what they just said" was empty once the owner had written after them. It now reads their last words whoever spoke after them.
- Checks that use a fake WhatsApp provider could hand it other workspaces' queued messages and mark them sent without sending them. `SenderService.tick(workspaceId)` now limits a pass to one workspace, and the check scripts use it.
- The words of one business (a client's name, a case study) were written into the source of the first-message checks; client names now come from each user's own brief.
- Replies mixed a shop's canned greeting from half an hour earlier into what the person had just said, and the role instruction leaked into the draft ("I am not a customer").
- A greeting corrected halfway ("Halo Kakak,").
- Lists, quotes and bold text in drafts were stripped to plain text.

## Unreleased (2026-10-12 to 13)

### Added
- **Pipeline to closing.** Replies are classified by rules (interested, meeting, price, question, not now, not interested, auto-reply); the lead moves forward only, is flagged as waiting for you, and gets a follow-up date when it asks for time. New lead fields `dealValue`, `lostReason`, `needsReply`, `lastIntent` and `inbound_messages.intent`; `GET /analytics/pipeline`; a Pipeline page; deal fields on the lead. STOP closes the lead as lost.
- **One message for many leads.** `GET /messaging/templates/categories|leads`, `POST .../generate|apply`; the Outbox Review tab can create one draft per selected lead from one message, with `{nama}` and `{kategori}`.
- **Replies skip the queue.** An approved `ai_reply` is sent ahead of cold messages, outside the pacing and limits.
- **Email link.** Optional per-account link (`email_accounts.ctaUrl`) added by the system before "Salam,".
- **Brief in the background** with progress and resume; campaign form can be filled instantly from the saved brief.
- Campaigns accept up to 2,000 leads; per-city searches return 40 or more instead of 12.

### Changed
- Replies: the action is chosen in code (none, fixed thanks wording, answer, next step), drafts are checked and retried, and quick or greeting-like answers are ignored. First messages: poor-fit businesses get no draft, words from other kinds of business trigger a retry, and facts are searched by the lead's own business type.
- First WhatsApp message: says who you are and what you offer in the first sentence, plain words, three rotating openings stored in the draft trace. First email: greeting, offer, "Salam,".
- Reply drafts are written for a business we approached: polite, no commands, no emoji, no guessed honorific.
- Website reading reads up to 40 pages (was 10), 150 seconds, 400,000 characters per source.
- Email sending is blocked, and approving email drafts is refused, while `PUBLIC_API_URL` is not a public https address (`ALLOW_LOCAL_UNSUBSCRIBE=true` for local tests).

### Fixed
- Scraper searched near the searcher instead of the requested city, and returned only about 6 per search.
- A shop's automatic greeting counted as a reply and got a reply draft; drafts mentioned capabilities that did not fit the lead's business; markdown symbols (`_booking_`) showed in messages; a source deleted during indexing caused a second error; slightly broken JSON from small models failed a whole brief pass.
- Messages from senders whose number WhatsApp hides are now kept and listed instead of being dropped (they still cannot be matched to a lead).

## Unreleased (edition work)

- **Several businesses per login.** A workspace menu in the sidebar lists the businesses you belong to, switches between them and creates new ones (`GET /workspace/mine`, `POST /workspace`, `POST /workspace/switch`). The token follows the active workspace and `GET /auth/me` now returns it.
- **AI provider per workspace.** Every AI feature (drafts, brief, fit, knowledge, AI Style, first-contact notes) now resolves its client from the workspace's saved provider, then the server `.env`. Settings gained an embedding model, a status line, "Test connection", and re-indexing after a model change. Saved keys are no longer sent back to the browser. `GET/PUT/DELETE /settings/ai`, `POST /settings/ai/test`, `POST /knowledge/reindex`.
- Security: only workspace owners and admins can change the AI provider, any integration, test it or re-index; a token's workspace membership is re-checked (cached 10 s) so a removed member loses access immediately instead of at token expiry; on a shared server connections to a workspace's AI endpoint are refused at connect time if the name resolves to a private address (no DNS rebinding, redirects included).
- On a hosted server a workspace's base URL must be public https (`AI_ALLOW_PRIVATE_BASE_URL=true` lifts this); self-hosted installs may use localhost.
- **Licence keys for self-hosted installs.** `/api/license` (status, set, remove, free key by email) and a licence card on the Billing page. Keys are exchanged for an Ed25519-signed document bound to the install, verified offline, refreshed daily, tolerated offline for 14 days. Nothing is sent unless a key is set. New table `instance_settings`. Docs: docs/editions.md.
- Added `EDITION` and an entitlements service; `GET /entitlements`; 402 `UPGRADE_REQUIRED`.
- **Entitlement provider interface.** Plans and limits now come from a provider; without the commercial package the Community provider allows everything. `LimitsService` enforces drafts, scrapes, workspaces and members per the provider's limits (402 `LIMIT_REACHED` / `SUBSCRIPTION_INACTIVE`). `usage_counters` and `usage_events` record monthly counts and AI token usage per call. A Billing page reads `/entitlements`. The error filter now keeps the `code`, `feature`, `metric`, `limit` and `used` fields of 402 responses. Plans, prices, subscriptions and payments are in a separate private package: docs/editions.md.
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
