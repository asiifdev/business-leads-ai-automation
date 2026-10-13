# Marketing Brief

The Marketing Brief is what Prospex knows about your product: what you sell, to whom, why it is different, and what you can prove. You do not write it from scratch. You give Prospex source material and it writes the brief, fills in your campaign form, and uses the brief later when it drafts messages.

## Why it exists

Two things go wrong when an AI writes outreach for a business it does not understand. It invents (customers, numbers, prices), and it writes generic text that fits any company. The brief addresses both:

- **It is built from your own material**, so the facts come from you.
- **Anything it cannot find is listed as missing** (`[NEED: ...]`) instead of being made up.
- **It is reviewed before it is used**: you see it on the *Marketing brief* page and in the campaign form, and you can correct the summary.

## What you can give it

| Source | How it is read | Limits |
|--------|----------------|--------|
| **Website** | The page you enter, plus the pages the site points to itself: `llms.txt` and `llms-full.txt`, `sitemap.xml` (and the sitemaps listed in `robots.txt`), and, when the site has no usable sitemap, the links on its home page. Pages are ranked (home, about, services, pricing, FAQ, portfolio and clients first, at most four blog posts) and up to **40 pages** are read. | Same site only (`www` and bare domain count as one). Ports 80 and 443. 2 MB per page, 12 seconds per request, about 150 seconds in total. Up to 400,000 characters of text are kept per source. |
| **JavaScript-only pages** | If a page's HTML has almost no text (the site builds its content in the browser), it is opened in the same headless Chromium that scrapes Google Maps and read after it has loaded. Images, video and fonts are not downloaded. | Needs Chromium installed (`playwright install chromium`). |
| **Text** | Pasted as is. | 30 to 200,000 characters. |
| **Files** | `.pdf`, `.docx`, `.md`, `.txt`. | PDF and DOCX up to 10 MB (PDF up to 60 pages, DOCX text only). Text files up to 1 MB. A scanned PDF with no text layer is refused: paste the text instead. |

A website only needs its main address: `https://asiifdev.com` is enough. Giving the AI one page and expecting it to understand a business is how briefs end up with guesses, so the whole site is read.

You can keep up to 40 sources per workspace, and two sites can be read at the same time. Sources are saved and reusable: tick the ones you want for a given brief.

## What it produces

The brief follows the structure of the `product-marketing` skill:

- **Summary**: two or three sentences, about 450 characters, in your voice. This fills the "Your service / product" field of a campaign.
- **Overview, audience, problem, what sets it apart.**
- **Likely objections** with an answer, only when the sources answer them.
- **Proof**: numbers, customer names and testimonials, copied from the sources.
- **Offer**: pricing and call to action, only when stated.
- **Voice**: the tone of the source and the words it uses or avoids.
- **Outreach angles**: one per type of customer business, each with a likely pain, an opening hook and a benefit. These are **hypotheses to test**, not facts.
- **Suggested campaign**: a name, the business type to look for, search queries, location, content style and language.

## How it avoids inventing

1. **The prompt** tells the model to use only the sources and to list missing information as `[NEED: ...]`.
2. **Three small passes** (positioning, evidence, outreach) instead of one large answer, because a long JSON object is where modest models misplace keys. A failed pass is retried once, and a pass that still fails is reported as a gap instead of hidden.
3. **A grounding check** after the model answers. A `[NEED: ...]` the model wrote into a field is moved to the missing list, and near-duplicate missing items are merged. Every number must appear in the sources, and customer names and testimonials must (mostly) appear too. Pricing must match a number in the sources. Anything that does not is removed and listed as missing. A model that writes "trusted by 500 businesses" cannot put it into a brief unless the sources say so.
4. **Outside text is data.** Web pages, files and notes sit inside delimiters, and the model is told that instructions inside them are to be ignored.

## What the campaign form does with it

The *New campaign* form starts with **Source material**. After you add sources and press **Analyze with AI and fill the form**:

- Name, target business type, location, search queries, the service description, content style and language are filled in.
- Each AI-filled field carries a badge. A field you have already edited is never overwritten.
- Parts the sources did not settle (location is the usual one) are listed under the button, and the field is left for you.
- **Target business type** is free text: it is the kind of business you want to find (for example "camera rental"), not your own industry. The suggestions below the field come from the brief.

## Where else the brief is used

- **Lead scoring.** For each scraped business, the AI judges how well it fits your offer from its name and its real Google Maps category, using the brief's description of your customers. The verdict and its reason appear on the lead.
- **Draft writing.** First messages and follow-ups receive the angle that matches the business type, the proof that may be mentioned, and the words to avoid. Without proof in the brief, the writer is told not to mention any.

Sources you add here are also indexed in the knowledge base (pgvector), so reply drafts can quote your facts.

## Running it with a local model

Ollama models work, with two settings that matter:

- `OPENAI_REASONING_EFFORT=none` turns off the thinking phase of reasoning models. In our test it cut a call from about 6 seconds to 0.6 seconds, and a brief from about 5 minutes to about 90 seconds on `gemma4`.
- Make sure the model's context window is large enough. The brief sends up to `BRIEF_SOURCE_CHARS` characters of source text (30,000 by default, about 8,000 tokens) in each pass. Lower it if your model has a small context.

The brief page and form always show which pages the AI read, so you can judge what the brief is based on.

## Limits to know

- The brief is as good as the sources. A thin site gives a thin brief with a long list of missing items. That is the intended outcome.
- Fit judgements and angles are the model's reasoning, shown with their reasons. They are aids for choosing whom to contact first, not predictions.
- **Check the brief.** A modest model can put a fact in the wrong section (a price under "what it costs them", for example). Every section is editable on the brief page (**Edit sections**, one list item per line), and each save becomes a new version. Review the proof and offer sections first.
- PDFs that are scans, password protected, or longer than 60 pages are not read.


## Writing the brief in the background

The brief is written in three passes (positioning, evidence, outreach), each a long JSON answer. With a small local model that takes several minutes, longer than a browser or proxy waits on one request, so it is a background job:

- `POST /api/marketing/brief/generate` starts it and returns at once; `GET /api/marketing/brief/generate/status` reports `running` (with the current pass), `done` (with the brief), `failed` (with a short reason) or `idle`.
- The page asks every few seconds and shows "step 1 of 3". You can leave it: opening the new-campaign page again while the job runs picks it up instead of starting another.
- One job per workspace at a time. The job lives in the API's memory, so restarting the API loses a job that was still running; start it again.
- A reply with a small JSON slip (an unescaped quote, a missing or extra comma, a cut-off ending) is repaired before it is given up on.

Because the result is saved, **you rarely need to run it again**: a new campaign can be filled instantly from the saved brief ("Fill from my saved brief"). Analyse again when your sources change.
