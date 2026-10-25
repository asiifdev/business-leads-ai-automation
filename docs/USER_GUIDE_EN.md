# Prospex — User Guide

A complete guide to using Prospex, from installation to your first closed deal. This is the English version of [USER_GUIDE.md](USER_GUIDE.md) (Indonesian) and follows the same 13 sections. Where the product changed after the Indonesian text was written (a campaign's country and language), this version is the more current one.

---

## Contents

1. [Installation and setup](#1-installation-and-setup)
2. [Configuring an AI provider](#2-configuring-an-ai-provider)
3. [Creating a campaign](#3-creating-a-campaign)
4. [Following a scrape's progress](#4-following-a-scrapes-progress)
5. [Managing leads](#5-managing-leads)
6. [Marketing Brief](#6-marketing-brief)
7. [AI Style: messages in your own voice](#7-ai-style-messages-in-your-own-voice)
8. [Outbox and WhatsApp](#8-outbox-and-whatsapp)
9. [CRM pipeline](#9-crm-pipeline)
10. [Analytics](#10-analytics)
11. [Exporting leads](#11-exporting-leads)
12. [Settings and API keys](#12-settings-and-api-keys)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Installation and setup

### Requirements

- Node.js 20+ (22 LTS recommended)
- pnpm 9+ — `npm install -g pnpm`
- Docker Desktop

> **Stack:** Next.js 16, NestJS 10, PostgreSQL 16, Redis 7

### Install

```bash
# Clone the repository
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation

# Install all dependencies
pnpm install

# Copy the configuration file
cp .env.example apps/api/.env
cp .env.example packages/database/.env
```

Edit `apps/api/.env` with at least:

```env
DATABASE_URL="postgresql://prospex:prospex@localhost:5432/prospex"
OPENAI_API_KEY=sk-your-key-here   # may be left empty: AI features are off, scraping and scoring still work
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small   # for AI Style and the knowledge base
```

The server also needs `JWT_SECRET` (at least 16 characters) and `ENCRYPTION_KEY` (base64); the API refuses to start without them. See the comments in `.env.example`.

### Start the infrastructure

```bash
# Start PostgreSQL (with pgvector) and Redis
docker compose up -d

# Apply the database migrations
pnpm --filter @prospex/database db:deploy
pnpm --filter @prospex/database exec prisma generate

# Install the browser used for Google Maps scraping and reading websites (once)
pnpm --filter @prospex/api exec playwright install chromium
```

### Start the application

Open two terminals:

```bash
# Terminal 1 — backend API (port 3001)
pnpm --filter @prospex/api dev

# Terminal 2 — dashboard (port 3000)
pnpm --filter @prospex/web dev
```

Open your browser at **http://localhost:3000**. The interface is available in English and Indonesian; switch it with the ID / EN toggle in the header or on the login page.

---

## 2. Configuring an AI provider

Prospex works with any provider that is compatible with the OpenAI API. Message drafts need a **chat model**; AI Style and the knowledge base also need an **embedding model** (`EMBEDDING_MODEL`).

> **Two places to configure the AI.** The server's `.env` file (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `EMBEDDING_MODEL`) applies to every workspace and needs an API restart. Under **Settings → AI Configuration**, each workspace can save its own key, models and base URL; this replaces `.env` for that workspace only and takes effect without a restart. A workspace without its own key uses `.env`.

### OpenAI

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

### OpenRouter (access to Claude, Gemini, Llama and others)

```env
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-haiku-4-5
```

OpenRouter does not offer an embedding model that suits every chat model, so check that the `EMBEDDING_MODEL` you choose is available.

### Ollama (local, free, offline)

```bash
ollama pull gemma4              # chat model
ollama pull qwen3-embedding     # embedding model
```

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=gemma4
EMBEDDING_MODEL=qwen3-embedding
```

A local model takes about 40 seconds per draft (depending on your hardware). Your chats never leave your machine.

> **Without an AI key:** scraping, rule-based scoring, the CRM, analytics and export keep working in full. The AI features (message drafts, AI Style, the knowledge base) are off. Prospex does not fill the gap with template text.

---

## 3. Creating a campaign

A campaign is Prospex's main unit of work. One campaign is one batch of lead searching, **in one country**.

### The quick way: let the AI fill in the form

The **New campaign** page opens with a **Source material** section on the left. Here you give the AI what it needs to know about your product or service:

| Source | How | Notes |
|--------|-----|-------|
| **Website** | Enter the main address, for example `https://yourcompany.example.com`, then press **Read site** | The main address is enough. Prospex reads `llms.txt`, the sitemap and the links on the home page, up to 40 pages, and opens pages that need JavaScript with a real browser. It runs in the background; the status shows in the source list. |
| **Text** | The *Text* tab: give it a title and paste the content (price list, FAQ, descriptions) | At least 30 characters |
| **File** | The *File* tab: choose a `.pdf`, `.docx`, `.md` or `.txt` file | PDF and DOCX up to 10 MB (PDF up to 60 pages); text files 1 MB. A scanned PDF (no text layer) is refused: paste its text instead. |

Then tick the sources you want to use (a newly added source is ticked automatically), add a note if needed (the *Anything else the AI should know* link), and press **Analyze with AI and fill the form**. It runs in the background and takes a few minutes with a local model (about 3 to 7 minutes for gemma4): the button shows "step 1 of 3", and you may leave the page and come back. If a brief already exists, **Fill from my saved brief (instant)** fills the form immediately without running the AI again; re-run the analysis only when your sources change.

The result:

- The form on the right is filled in: campaign name, target business type, location, search keywords, service description, content style and language. Every value that came from the AI carries an **AI** mark.
- Anything the sources cannot settle (usually the location) is **left empty** and listed in the "Not found in your sources" box.
- Values you typed yourself are **never overwritten**.
- Check everything, correct what is off, then press **Start campaign**.

The analysis is saved as the **Marketing Brief** (section 6), which is also used when the AI judges leads and writes drafts.

### Filling in the form yourself

You can always fill in the form without sources:

| Field | Example | Notes |
|-------|---------|-------|
| Campaign name | "Camera rental Austin Q4 2026" | A name for you to recognise it by |
| Target business type | camera rental | **The kind of business you want to find**, not your own line of work. Free text; there is no fixed list because Google Maps categories vary widely. |
| Country | Egypt | The country the campaign searches in. One campaign searches one country; make another campaign for the next country. Defaults to Indonesia. |
| Location | Cairo | The target city or area. Several areas can be separated by commas, semicolons, `/`, `&`, `+`, "and" or new lines. A typed city is searched in that city itself (results more than about 50 km from the city centre are dropped). Outside Indonesia, a text such as "Austin, Texas" is first checked on Maps as one place and only split into several places if it is not one. For Indonesia only, typing **Seluruh Indonesia** (all of Indonesia) runs one search per city, starting with the biggest. |
| Search keywords | "camera rental" | As you would type them into Google Maps. You may add more than one. |
| Your service / product | "A rental management system for camera rental shops" | What you offer these leads |
| Max results | 20 | Target number of leads (10 to 1,500 in the form; the API accepts up to 2,000). The campaign stops as soon as the target is reached. |
| Content style | Balanced | Professional / Friendly / Balanced / Casual |
| Language | follows the country | The language the outreach is written in: Indonesian, English or any other language. When you change the country, the language changes with it (Indonesia: Indonesian, Egypt: Arabic, the United States: English) until you pick one yourself. |

Press **Start campaign**: the system starts searching Google Maps straight away and scores the results.

### Keyword tips

- Name the type of business the way Google Maps writes it: `"mobile phone shop"`, `"dental clinic"`, `"car rental"`.
- Do not use the name of your own service (`"website development"`) or a job title (`"operations manager"`): those are other service providers or people, not businesses listed on Maps. Prospex removes entries like that from the AI's suggestions.
- Add several keywords for wider coverage.
- Be specific about the place: `"beauty salon zamalek"` beats `"salon"`.

### Scraping requirements

Scraping uses a Chromium browser on the server. Install it once with `pnpm --filter @prospex/api exec playwright install chromium`. If the browser is missing or a search fails, the campaign ends as **Failed** with a clear message. Prospex never fills the lead list with invented businesses.

---

## 4. Following a scrape's progress

After a campaign is created, its detail page shows progress in real time.

### Campaign status

| Status | Colour | Meaning |
|--------|--------|---------|
| `draft` | Grey | Not started |
| `running` | Blue + spinner | Scraping and scoring |
| `completed` | Green | Done, leads available |
| `failed` | Red | Failed. The cause is shown (for example, the browser is not installed); see the API log too |

### Progress bar

Progress updates automatically every 2 seconds:

- **0–30%** — start-up and scraping
- **30–60%** — scoring all leads
- **60–95%** — judging how well each business fits your offer (needs an AI provider) and preparing the e-mail and phone notes for HIGH-priority leads
- **100%** — done

---

## 5. Managing leads

### The Leads page

Open **Leads** in the sidebar to see every lead from every campaign.

**Available filters:**
- Search box: name, address, phone number (typing "0812" also finds numbers stored as 62812), website, e-mail, category and region
- Priority: HIGH / MEDIUM / LOW
- **Data quality**: Reliable / Check before sending / Not ready to contact. A lead that is permanently closed, a duplicate, has no contact, or whose number is not on WhatsApp is rated low and skipped when drafts are made in bulk. The **Recheck data** button rates every lead again (including ones saved before this feature) and marks the same business in other campaigns.
- CRM status: New / Contacted / Replied / Interested / Meeting / Won / Lost
- **Province, city/regency and district**: worked out from each lead's coordinates (a Google Maps address rarely names the city). The **Classify area of N leads** button runs it in the background; leads from a new scrape are processed automatically. The free service used allows one request per second, so hundreds of leads take a few minutes. Set `GEOCODER_URL` to your own Nominatim to go faster.
- **List / Map** tabs: the list is paged ("Page 1 of 17") and the map shows **every** lead that has coordinates, not just the first page.

### Reading websites and Instagram/Facebook pages

- **Find contacts** (on a lead or campaign page) reads the business's website: e-mail, WhatsApp number, social profiles and what the business says about itself (description, type of business, opening hours, address). That information appears in the "Found on their website or page" card and is used by the draft writer only as background.
- A lead **without a website** can still be read if it has a public Instagram or Facebook page (given as its website, or listed in OpenStreetMap): only the public preview is read (name and bio), then the numbers and e-mails written in the bio. A page that asks for a login is reported as unreachable.
- This data never overwrites values from Google Maps; it only fills what is empty, and the source of every value is recorded.
- **Refresh old data** (Leads page) reads again the leads that were never read or were last read more than 90 days ago, 50 per press. Before bulk drafts are made, old data is also read again automatically.
- A phone number written on a website without its country code is read in the campaign's country.

### Lead sources and file import

- In the campaign form, **Where to look** chooses the source: **Google Maps** (has ratings and reviews) and/or **OpenStreetMap** (free; finds businesses that are not on Maps, only those with a phone, website or e-mail, with no ratings; one search can take a minute). A third source, **Overture Maps** (open place data from Meta, Foursquare and others; free), finds many small businesses that only have a Facebook page, most with a phone number; the first search after the server starts can take several minutes (about five in our test), later ones only seconds. Sources are tried in order; the second only fills what is left of the target, and the same business found in two sources is merged into one lead. For OpenStreetMap, common business types (restaurant, workshop, pharmacy, camera shop) are recognised; for other types write the tag, for example `craft=carpenter`.
- On the campaign page, **Import file** adds businesses from a CSV or Excel (.xlsx) file, up to 2,000 rows and 5 MB. Columns are recognised from their headings (English or Indonesian) and you can change them before importing; a preview shows how many leads would come in and what is skipped. Imported leads are treated like scraped ones (score, duplicate check, data quality, contact reading). Phone numbers in the file are read in the campaign's country. The **Website** tab accepts a list of website or Instagram/Facebook page addresses (up to 200): each address is opened to find the business's name and details; ones that cannot be opened or are parked pages are named in the campaign's note and skipped. The list of sources, their cost and terms, and the sites that were deliberately not built is in `docs/lead-sources.md`.

### Lead priority

The score (0–100) is an **ordering index**, not a sales prediction. It helps you choose whom to contact first.

| Score | Priority | Meaning |
|-------|----------|---------|
| 70–100 | HIGH | Contact first |
| 50–69 | MEDIUM | Standard order |
| 0–49 | LOW | Contact when you have capacity |

### Where the score comes from

Only from real scraped data, plus one AI judgement. No industry or city weights are written by hand.

| Signal | Points |
|--------|--------|
| Base | 30 |
| Has a phone number (can be contacted) | +15 |
| Has an address | +3 |
| Rating (Bayesian average: a rating with few reviews is pulled towards 4.0, so 5.0 from 1 review does not beat 4.5 from thousands) | +5 / +10 / +15 for 3.5 / 4.0 / 4.5 |
| Number of reviews | +2 / +5 / +10 for 5 / 20 / 100 reviews |
| **Fit with your offer** (an AI judgement from the business's name and real Google Maps category, against your offer and brief) | +20 high, +8 medium, −15 low, 0 when not judged |

The reason for the fit judgement is shown on the lead's detail page. The name counts too: a business called "Camera Rental X" is judged relevant to a rental system even if its Maps category is only "Camera store". This judgement needs an AI provider; a small local model can be wrong, which is why the reason is always shown. A lead without a phone number gets a note, because it cannot be reached on WhatsApp.

The category shown on each lead is the **real Google Maps category** (its language follows the language of the Maps interface).

---

## 6. Marketing Brief

The **Marketing brief** menu shows what Prospex knows about your product: what you sell, to whom, what makes it different and what proves it. The AI writes this brief **from your own sources** (section 3) and every campaign and draft reads it.

### What the brief contains

A summary (used to fill campaigns), an overview, the audience, the problems, the differences, outreach angles per type of business (hypotheses to test, not facts), likely objections, evidence (numbers, customers, testimonials), the offer (price, call to action) and the brand voice.

### Rules so that nothing is invented

- Facts come only from the sources. Numbers, customer names, testimonials and prices that are not found in the sources are **removed** and listed in the yellow **Missing information** box.
- What cannot be determined is left empty, not guessed. An empty value is shown as "Not found in the sources".
- The page shows **which pages the AI read** (at the bottom), so you can judge the basis of the brief.

### Editing and generating again

- Click **Edit sections** to change any section (lists: one item per line), then **Save changes**. Every save raises the version number.
- Click **Generate again** after adding sources or notes. This replaces the previous brief.
- The AI model can put content in the wrong place (for example a price in another field). The brief is a starting point you must check, especially the evidence and offer sections.

### Where the brief is used

- **Campaign form**: fills the name, target business type, keywords, description, style and language.
- **Lead score**: the basis of the fit judgement.
- **Message drafts**: the angle that matches the lead's type of business, the evidence that may be mentioned (only what is in the brief) and the words to avoid.
- Added sources also go into the knowledge base, so reply drafts can quote your facts.

The brief itself is written in Indonesian or English. Technical details and limits: [marketing-brief.md](marketing-brief.md).

---

## 7. AI Style: messages in your own voice

This feature is optional, but it makes drafts sound like you instead of like an AI assistant. Open the **AI Style** menu.

### How to export a chat

In WhatsApp: open a chat, then **More → Export chat → Without media**. The result is a `.txt` (or `.zip`) file. Repeat for several conversations, especially with customers. The more conversations, the more accurate the result.

### Steps in Prospex

1. Drop the export file into the upload box, then click **Read file**.
2. Choose your name from the list of senders (the one who wrote the most is already selected).
3. Click **Learn my style**. With a local model (Ollama) this can take a few minutes.
4. Try it in the **Try one message** box: paste a customer's message and see the draft and its trace (the habits used, the similar replies of yours it found, the facts it found).

### What is stored

Statistics about how you write, and anonymised "customer message → your reply" pairs (numbers, e-mails and links are replaced). **The original chats are not stored.** The **Delete** button removes everything. Details and test results: [ai-style.md](ai-style.md).

You need at least 30 messages of your own. If you change the embedding model in the server settings, import your chats again.

### WhatsApp drafts and other messages

WhatsApp messages are no longer made automatically during scraping. Drafts are made from the **Outbox** menu (section 8), using the lead's real data (rating, number of reviews, no website yet), your style and your knowledge base. On a lead's detail page there are still e-mail, LinkedIn and phone notes written by the AI for HIGH-priority leads, once an AI provider is set up. Without an AI provider, Prospex shows no default text.

### Language of the outreach

Drafts and notes are written in the campaign's **language** (section 3). For a language other than Indonesian or English, the AI is asked to write the whole message in that language. These parts stay in Indonesian or English whatever the campaign's language is: the opt-out line, the "more details" line, the e-mail unsubscribe footer, the ready-made thank-you and goodbye replies, and the Marketing Brief.

---

## 8. Outbox and WhatsApp

The **Outbox** menu is where every outgoing message lives. The principle: **every message starts as a draft and is not sent before you approve it.**

### Connect WhatsApp

1. Click **Connect WhatsApp**. A QR code appears.
2. On your phone: WhatsApp → **Settings → Linked devices → Link a device**, then scan it.
3. The status changes to "Connected as +62…" (your own number's country code).

Use a **number dedicated to the business**. A linked-device connection is unofficial, and WhatsApp can restrict a number it considers automated. Prospex lowers the risk but cannot remove it. See [DISCLAIMER.md](../DISCLAIMER.md).

### Creating and reviewing drafts

1. The **Review** tab → choose a campaign and a number (at most 200) → **Write drafts**. Writing runs in the background, so you may leave the page. A local model takes about 40 seconds per draft.
2. For each draft: **Approve**, **Edit** (change the text first) or **Reject**. **Approve all** asks for confirmation first.
3. A draft marked yellow needs a careful read: it contains a link, a price, a discount, or text that reads like an instruction to the AI.
4. Approved drafts move to the **Queue** tab and are sent one at a time. You can still take one out of the queue.

A lead whose number is invalid, who has already been contacted, or who has opted out is skipped automatically. Every first message and follow-up ends with a "reply STOP" line.

The first WhatsApp message has no character limit; what matters is that every sentence is useful. The first sentence says who you are and what you offer in everyday words. If what you offer is a **service** (for example an agency that builds systems to order), the message introduces the company, names the scope of the service in plain words, then invites a conversation; it does not offer a "preview" or demo that does not exist yet. If what you offer is a **ready product**, the message may offer an example or demo. In a real test, a message that opened straight with a question and no introduction was taken for a customer wanting to rent something. Read every draft; a small model sometimes misreads a rating or writes stiff sentences (such drafts are marked yellow).

### Formatting, attachments and link previews

- **WhatsApp formatting** is kept: `*bold*`, `_italic_`, `~strikethrough~`, lists with `- ` and blank lines between paragraphs. The Outbox shows every message as a WhatsApp bubble: a file or link card on top, the text below, and the "reply STOP" line as a small footnote.
- **Attachments**: when editing a draft (or in the "One message for many leads" panel) choose **Upload a file**: PDF, JPG, PNG, WebP, MP4, DOCX, XLSX or PPTX, up to 16 MB. The file type is read from its contents, not its name. The message text becomes the file's caption; if it is longer than 1,024 characters (WhatsApp's limit) the text is sent as a separate message right after the file. A file that a waiting message still uses cannot be deleted. E-mail does not support attachments yet.
- **Link previews**: a link in a message automatically gets a card (title, description, image) that you see before approving. Turn it off with the checkbox if you prefer. A page that cannot be read is sent without a card.

### One message for many leads

When per-lead drafts disappoint you and you want one message that you control for one type of business (for example all kebaya rental shops):

1. In the **Review** tab, open the **One message for many leads** card.
2. **Choose leads**: pick a *Business type* (a Google Maps category; the number next to it is reachable/total), or search by name (for example "kebaya"). Leads without contact details or that were already sent a message are marked and cannot be chosen. Use **Select all reachable**.
3. **Write the message** yourself, or press **Write with AI for this business type** (one AI call for one template, not per lead), then edit as you like. `{nama}` is replaced with each lead's business name and `{kategori}` with its type. For e-mail, fill in the subject too.
4. Press **Create N drafts**. Every lead gets its own draft in the Review list (WhatsApp automatically gets the "reply STOP" line, e-mail gets the footer). You still approve as usual; nothing is sent before that.

Because every recipient gets the same text, use `{nama}`, send in small groups, and spread them over several days to keep the number safe.

### Sending speed

Click **Limits** to set:

| Setting | Default | Notes |
|---------|---------|-------|
| Messages per hour | 10 | 1 to 30. The lower, the safer. |
| Messages per day | 80 | 1 to 200 |
| Quiet hours | 21:00 to 07:00 | Messages wait until quiet hours end |
| Time zone | Asia/Jakarta | Set it to your own |
| Default country code | 62 | Used for numbers written without a country code. Numbers from other countries are stored with their own code, so this only matters for numbers typed without one. |

The gap between messages is randomised (0.6 to 1.4 times the average), and "typing…" is shown before each message is sent. With the defaults, a list of 1,500 leads takes about **19 days**. Raising the daily limit to 140 shortens it to about 11 days. At 20 per hour and 200 per day, 1,000 leads take about 5 days. At 20 per hour one message goes out about every three minutes; a long queue is slow on purpose. Start with 30 to 50 leads, see how many reply and whether the number stays healthy, then raise the limits.

Prospex pauses sending automatically after 3 failures in a row. There is also a **Pause sending** button if you want to stop yourself.

### Replies and follow-ups

- **A lead replies**: Prospex understands the intent (interested, wants a meeting, asks the price, a question, not now, not interested), moves the status forward (never backward), marks the lead "waiting for your answer", cancels any pending follow-up, and creates a **reply draft** in the Review tab with the customer's message quoted above it. Reply drafts are written politely and modestly (you are the one making the offer): no emoji, no commands, no guessing how to greet. You still approve, and an approved reply is **sent immediately, ahead of the queue of first messages**, and is not subject to the per-hour limit.
- **Prospex reads the whole conversation**: bubbles written close together (at most 3 minutes apart) are answered as one message, a shop's automatic greetings and old chats only become history, and photo captions and contact cards are read too. A draft is written about 20 seconds after the last bubble, **replaces an older draft** that is still waiting, and is not made if you have already answered.
- **You reply from your own phone**: the message is recorded (only for numbers that are on your lead list; other private chats are ignored and not stored), the lead is no longer "waiting for your answer", a stale draft is withdrawn, and the next draft knows what you already said. These messages do not count towards the hourly and daily send limits.
- **Redirected to another contact** ("please contact our management", or they share a contact card): the reply is a fixed thank-you (or a request for the number), the number is saved in the lead's activity log, and the **Add … as a lead** button creates it as a lead of its own, once only for the same number.
- **A shop's automatic greeting** ("Thank you for contacting…", "please wait", opening hours, a long menu) is recognised and only recorded: the status does not change and no draft is made.
- **A customer writes STOP** (or "stop", "unsubscribe" and similar, including inside a short sentence such as "Sorry not now STOP"): the number is blocked permanently, all waiting messages are cancelled, and the lead is closed as Lost with the reason "Asked to stop (STOP)".
- **A quiet lead**: Prospex creates a follow-up draft after 3 days, and another 5 days later. At most two. The **Check follow-ups** button runs it now.
- A message from an unknown number is saved but not answered. WhatsApp sometimes hides the sender's number; such a message appears on the **Pipeline** page in the "Messages from unknown senders" card and cannot be matched to a lead, so if it says STOP, remove that business from your list by hand.

### The "Needs attention" tab

Holds messages that failed, for example "Number is not on WhatsApp" (that number cannot be reached) or a sending failure. **Try again** appears for those worth retrying. A message cut off by a server restart is marked failed and is **not resent automatically**, because it may already have been delivered. Check WhatsApp first.

The full technical description: [whatsapp-outbox.md](whatsapp-outbox.md).

---

### Sending by e-mail

In the Outbox, choose **Email** above the message list. The flow is the same as WhatsApp: the AI writes a draft and a subject, you review, change and approve. Nothing is sent without your approval.

1. Press **Set up email** and enter your SMTP account (server, port, user name, password, sender address) and your **postal address**. That address is printed under every e-mail, and many countries require it. Many providers need an *app password*, not your normal password.
2. Press **Test connection**. This only logs in; it sends nothing.
3. Press **Write drafts**. The leads that can be e-mailed are those whose address was found on their website (see "Find contacts" on the campaign and lead pages).
4. Review, approve, and e-mails go out one at a time with gaps and quiet hours.

Every e-mail carries an unsubscribe link. A person who unsubscribes is never e-mailed again. For recipients to be able to open that link, set `PUBLIC_API_URL` on the server to a public https address (for example `https://api.example.com/api`). **Until it is set, e-mail sending is stopped and approving e-mail drafts is refused**, with a red warning in the Email panel. E-mails are formatted as: "Hello,", short paragraphs, an invitation, "Regards,". In the Email panel you can fill in an optional **Link in the first e-mail**; the system adds it as one "More details: …" line before the closing. Replies arrive in your own mailbox; Prospex does not read them yet. Set up SPF, DKIM and DMARC on the sending domain, and start with small numbers. Details and limits: [email-channel.md](email-channel.md).

## 9. CRM pipeline

### The Pipeline page: follow a lead to closing

The **Pipeline** menu shows the whole journey of a lead:

- **Four numbers**: reply rate, win rate, value of open deals, value of won deals. The reply rate counts only human replies, not a shop's automatic greetings.
- **Stages** from New to Won or Lost, with the count and deal value.
- **Waiting for your answer**: leads that replied and that you have not handled yet, with their intent (for example "Asks the price"). **Time to follow up**: the date you or the system set has passed. **Quiet**: contacted more than 7 days ago with no reply. Each lead in these lists shows an intent badge and how long ago ("2 hours ago", "3 days ago").
- **Per campaign**: number of leads, contacted, replied, won. **Reasons deals were lost**: counted from the reason field.
- **Messages from unknown senders** (when there are any).
- **Waiting on them**: leads that have replied (stages Replied to Proposal) where **you answered last**, but more than 3 days have passed with no reply. It is only a reminder for you; there is no automatic draft, because a lead like this is in progress (for example asked to fill in a form) and is not a cold prospect.
- **Re-read conversations**: the button at the top of the page re-reads every conversation in full (including your replies from your phone). A **preview** appears first: how many conversations would change, how many you have already answered, new labels, stages that move up, and stale drafts that are withdrawn. Nothing changes until you press **Apply**. The preview also shows the two most important things: **leads that only sent a shop's automatic greeting** (returned to "Contacted", because that is not a reply) and **numbers that already asked to stop but are not yet blocked** (they will be blocked and closed as Lost). A label that is already specific is never overwritten by "other". A stage that was set automatically and was never really reached (for example "Meeting" because of the word "schedule") is moved down, while a stage you chose yourself is never moved down. A conversation that continues with an answer of yours that was not recorded (typed on your phone before recording existed) is left as it is and reported as "incomplete". In the "Waiting for your answer" card, the **I answered** button on each row marks a lead you already replied to from your phone. Polite acknowledgements ("Ok", "thanks") do not count as waiting for an answer. The result: a lead you already answered no longer waits, labels match the conversation, stages only move forward, and a draft for a message that has been overtaken is replaced by a new one if something still needs answering.

On a lead's detail page, besides the status there are **Deal value**, **Follow up on**, **Why was it lost?** (shown when the status is Lost) and the **Mark reply as handled** button. A deal is never closed automatically, except a STOP request, which is closed as Lost.

### Updating a lead's status

On a lead's detail page, the **CRM Status** panel on the right:

1. Choose a new status from the dropdown
2. Click **Update Status**

The status records a timestamp automatically (for example `contactedAt`, `repliedAt`, `closedAt`).

### Suggested CRM flow

```
New → Contacted → Replied → Interested → Meeting → Proposal → Won
                                                 ↘ Lost
```

| Status | When to use it |
|--------|----------------|
| **New** | Just found, not contacted |
| **Contacted** | First message or e-mail sent |
| **Replied** | The prospect has replied |
| **Interested** | Agreed to your offer (for example "yes please" to an offer of an example) or asked for an example or information. Moves up automatically from replies, never backward |
| **Meeting** | A meeting or demo is scheduled |
| **Proposal** | A proposal has been sent |
| **Won** | Deal closed, now a customer |
| **Lost** | Did not happen, declined, or no response |

### Activity log

Every status change is recorded automatically in the **Activity Log** in the right-hand panel of the lead's detail page. It helps you track the history of the conversation.

---

## 10. Analytics

Open **Analytics** in the sidebar.

### Main metrics

- **Total Leads** — all leads from all campaigns
- **Conversion Rate** — the percentage of leads that became Won
- **Deals Won** — the number of deals closed successfully
- **Active Campaigns** — campaigns that are running or completed

### Charts

**Leads by Industry** — a bar chart of the number of leads plus the average score per industry. Useful for seeing which industry has the most good leads.

**CRM Funnel** — a pie chart of how leads are spread over the pipeline stages. If many are in "Contacted" but few in "Replied", your message is not engaging enough.

---

## 11. Exporting leads

### From a campaign's detail page

On `/campaigns/:id` there are 3 export buttons:

| Format | Use |
|--------|-----|
| **CSV** | Import into Excel, Google Sheets, other CRMs |
| **JSON** | Integration with apps or automation (Zapier, n8n) |
| **vCard** | Import straight into your phone's contacts or Outlook |

### From the leads list

On `/leads`, the **Export CSV** button at the top right exports all leads.

### vCard format

A `.vcf` file can be opened directly on a phone to save contacts:
- Business name
- Phone number
- Full address
- Website
- AI score and priority (in the Notes field)

---

## 12. Settings and API keys

### AI Configuration

**Settings → AI Configuration** — the key, chat model, embedding model and base URL for the active workspace. They are stored encrypted in the database, take effect without a restart, and the key is never shown again after it is saved (leave the field empty to keep the existing key). The **Test connection** button makes one chat call and one embedding call with the settings actually in use. If the embedding model is changed, knowledge sources need to be **re-indexed** and AI Style needs to be imported again.

### Several businesses (workspaces)

One login can hold many businesses. Click the workspace name at the top left, pick another business, or **New workspace**. Each workspace has its own marketing brief, AI Style, knowledge base, WhatsApp number, e-mail account, AI key, campaigns, leads and API keys; nothing is mixed.

### Prospex API keys

To access the Prospex API from external tools (Zapier, n8n, custom scripts):

1. Settings → **Prospex API Keys**
2. Enter a key name (for example "Zapier", "Production")
3. Click **+**
4. **Copy the key that appears now** — it is not shown again
5. Use it as a Bearer token: `Authorization: Bearer px_...`

### Deleting an API key

Click the trash icon to the right of the key you want to delete. The key stops working immediately.

---

## 13. Troubleshooting

### The API cannot be reached (frontend error)

```
Error: Failed to fetch http://localhost:3001/api/...
```

Make sure the API is running:
```bash
pnpm --filter @prospex/api dev
# You should see: "Prospex API running on http://localhost:3001"
```

### Database error when starting the API

```
Error: Can't reach database server at localhost:5432
```

Make sure Docker is running:
```bash
docker compose up -d
docker ps   # prospex_db and prospex_redis should be listed
```

### The API refuses to start

The API checks its configuration at boot and names the problem, for example `JWT_SECRET` shorter than 16 characters or a missing `ENCRYPTION_KEY`. An empty `PUBLIC_API_URL`, as in the stock `.env.example`, is accepted.

### A campaign is stuck on "running"

Refresh the page — if it is still running after a long time, restart the API:
```bash
# Ctrl+C in the API terminal, then:
pnpm --filter @prospex/api dev
```

### A campaign found places in the wrong country

Check the **Country** on the campaign page. A campaign looks places up in its own country, so "Springfield" in a United States campaign is not the Springfield elsewhere. If Maps cannot find the place you typed, the API log says `Maps did not find "..." as a place` and the results are not checked against a location.

### "Failed to fetch" during AI analysis, or a 500 error from Ollama

- The analysis now runs in the background; if "Failed to fetch" appears, the API has usually restarted (the `--watch` mode restarts the API on every code change). Wait a few seconds and run it again. A page that is reopened continues an analysis that is still running.
- Ollama serves one request at a time. Do not run analysis, indexing and draft writing together. A context length of 16,384 tokens is enough (the biggest prompt is about 7,000) and much lighter than 131,072; set *Context length* in the Ollama app.
- For the next campaign do not analyse again: use **Fill from my saved brief**.

### An e-mail is not sent although approved

The Email panel shows a red warning if `PUBLIC_API_URL` is not yet a public https address. Set it to the API's public address, then restart the API. (`ALLOW_LOCAL_UNSUBSCRIBE=true` is only for local tests to your own mailbox.)

### Prisma error after a schema update

```bash
pnpm --filter @prospex/database db:deploy
pnpm --filter @prospex/database exec prisma generate
```

### Port 3000 or 3001 is already in use

```bash
# Find the process using the port
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### A campaign fails with a message about the browser

"The scraping browser is not installed on the server": run `pnpm --filter @prospex/api exec playwright install chromium` on the API server, then run the campaign again. Any other message means Google Maps failed to load or changed; try again later or reduce the number of keywords. Prospex will not fill the results with invented businesses.

### A site cannot be read in Source material

- The message "that address is not allowed": the address points to an internal or local network. Only public sites (ports 80 and 443) can be read.
- The message "almost no text": the site loads its content with JavaScript. Prospex tries to open it with a browser; if Chromium is not installed yet, install it, or paste the text.
- A site with a login, or one that blocks bots, cannot be read: paste the text or upload a document.
- A PDF is refused: it may be a scan (no text), password protected, or longer than 60 pages.
- The AI analysis is very slow or fails with a local model: turn on `OPENAI_REASONING_EFFORT=none` for models that think (gemma4, qwen3) and lower `BRIEF_SOURCE_CHARS` if the model's context is small.

### The WhatsApp QR code does not appear or stays on "Connecting…"

- Make sure the server can reach the internet (WhatsApp Web uses WebSocket).
- Click **Disconnect**, then **Connect WhatsApp** again. The code changes every few seconds; scan the latest one.
- Check `WHATSAPP_DISABLED` in `.env`: the value `true` turns WhatsApp off.
- Look in the API log for the message `WhatsApp closed (code …)`. After 8 reconnection attempts Prospex stops and shows the error in the Outbox.

### A message is approved but not sent

Check in order: (1) the status must be "Connected" and sending must not be paused, (2) whether it is quiet hours, (3) whether the hourly or daily limit has been reached (see the "This hour" and "Today" meters), (4) whether the random gap between messages has passed. The **Queue** tab shows the order, and the WhatsApp panel shows the quiet hours and the meters for this hour and today.

### I have to scan the QR again after every deploy

The WhatsApp session is kept in `WA_AUTH_DIR`. In production that directory must be on a persistent volume (`docker-compose.prod.yml` already mounts the `wa_auth` volume).

### Reset the database (development)

```bash
pnpm --filter @prospex/database exec prisma migrate reset   # deletes the data and reapplies every migration
```

---

## Useful shortcuts

| Action | How |
|--------|-----|
| New campaign | `/campaigns/new` |
| See all leads | `/leads` |
| Swagger API docs | `http://localhost:3001/api/docs` |
| Database browser | `pnpm --filter @prospex/database db:studio` |

---

## What has and has not been verified

This guide follows the code on `main`. Behaviour that was checked by running it: scraping and scoring, the campaign country and language (campaigns for Egypt and the United States against live Google Maps), and the numbers in the scoring and sending-limits tables (read from the code). Behaviour that was only tested with a stand-in, and not described from experience, is listed as "Simulated" in [features.md](features.md); read that file for the status of each feature. Parts of this guide describing features that were not run again while writing it (WhatsApp sending, e-mail, the pipeline page) are translated from the Indonesian guide and follow the code at the time of writing.
