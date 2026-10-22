# Proposal: trustworthy data first, more lead sources

Status: Part 1 (data trust) is built (see [features.md](features.md) "Data quality"): provenance, free checks, closed status, duplicate marking, the gate on bulk drafting, re-reading old data, the quality filter, recompute for older leads and the lead page card. Part 2 (more sources) is not built yet. Prompted by two pieces of community feedback:

1. "Data enrichment first. In outreach, a wrong role or stale company detail kills trust before scoring matters, and AI scoring on shaky inputs is just a very organized guess."
2. Add sources beyond Google Maps, because many businesses have no Maps listing.

## Where we are today

- **One source.** `GoogleMapsScraperService` is the only producer of leads. `Lead.source` exists (default `google_maps`), but the pipeline in `scraper.processor.ts` assumes Maps (`Campaign.searchQueries` are Maps queries).
- **Enrichment is narrow.** `leads/enrichment.service.ts` reads a lead's own website (home plus up to two contact/about pages) and stores emails, WhatsApp numbers and social profiles in `Lead.enrichment`. It fills empty fields only and guesses nothing.
- **Gaps that match the feedback:**
  - No per-field provenance or confidence. A phone from Maps, one from a website footer and one resolved from `wa.me/<username>` look the same to the draft writer.
  - No validation: phone numbers are normalized but not checked for WhatsApp registration; emails are not checked at all; a dead or parked website still counts as `hasWebsite`.
  - No staleness handling: `enrichedAt` is stored but nothing re-checks old data, and nothing flags "permanently closed" listings.
  - Scoring (`LeadIntelligenceService`) uses listing signals plus fit. It never asks "how much do we trust this lead's data?"
  - Leads without a website cannot be enriched at all.

## Part 1: data quality before scoring

### 1.1 Field provenance and confidence
Store, for each important field (phone, email, website, address, category, and any name or role), where it came from, when it was last verified and a confidence level.

- New JSON column `Lead.fieldMeta`: `{ phone: { source: "google_maps" | "website" | "wa_profile" | "import", verifiedAt, confidence: "high" | "medium" | "low" } }`.
- Enrichment keeps filling gaps only, but records the source, so conflicts become visible instead of silently resolved.

### 1.2 Validation steps (cheap, no guessing)
| Check | How | Result |
|-------|-----|--------|
| Phone is on WhatsApp | `WhatsappProvider` lookup (Baileys `onWhatsApp`), rate limited, only for connected workspaces | `phone.waRegistered` true/false/unknown |
| Email shape and domain | Syntax plus MX lookup. No SMTP probing | `email.deliverable` likely/unlikely/unknown |
| Website alive | Fetch through `url-fetch.ts`; detect errors, parked-domain pages, redirect to an unrelated domain | `hasWebsite` becomes true only for a live site |
| Business still open | Keep Maps "permanently/temporarily closed" flag from the scraper | Closed leads are excluded from drafts |
| Duplicates | Match on `phoneE164`, website domain, then name plus distance | Merge or flag across campaigns and sources |

### 1.3 Staleness
Re-enrich when `enrichedAt` is older than a configurable window (default 90 days) and always right before a first message is approved. Show "data checked N days ago" in the lead detail and the Outbox.

### 1.4 Data-quality gate, separate from the score
Compute `dataQuality` (high / medium / low) from 1.1 and 1.2. Do not mix it into the fit score. Instead:

- The draft writer receives only fields with enough confidence, and never states a name, role or detail it cannot ground (same rule as `groundBrief`).
- A low-quality lead gets a `draftRisks` flag in the Outbox ("phone not on WhatsApp", "website unreachable", "data older than 90 days").
- Lead list can filter and sort by data quality; bulk "generate drafts" skips low-quality leads by default.

Note on "wrong role": Prospex sells to local businesses, so it mostly addresses the business, not a named person. Keep it that way: only use an owner or contact name when it is printed on the business's own site or provided in an import, and store it with its source.

### 1.5 Richer enrichment from the business's own site
Extend the existing crawl (already safe via `url-fetch.ts`) to also capture a short description, services/products list, opening hours and address. These feed the draft writer as grounded facts and improve fit judgement.

## Part 2: more lead sources

### 2.1 Make sources pluggable
Introduce a `LeadSource` interface, the same shape as `WhatsappProvider`:

```ts
interface LeadSource {
  id: string;                       // "google_maps", "osm", "csv_import", ...
  search(input: SourceQuery): AsyncIterable<RawLead>;
}
```

- `Campaign` gets `sources: string[]` (default `["google_maps"]`). Keep `searchQueries` for Maps; other sources read their own config.
- `ScraperProcessor` runs the selected sources, merges and dedupes (1.2), then scores. `Lead.source` and `referenceUrl` already record origin.
- Invariants stay: no fabricated leads, any user-supplied address goes through `url-fetch.ts`, each source declares its terms-of-use status in the docs.

### 2.2 Cost rule
Prospex is a scraping system, so the only paid dependency is the AI provider. Every source and validation step must be free to run: no paid place or enrichment APIs (Google Places, Foursquare, Bing, Hunter-style email finders, paid verification services). Free tiers that need a key or a card are also out. Anything added must work on a plain self-hosted install with only the AI key as a cost.

Free checks used in Part 1: Baileys `onWhatsApp` (the workspace's own linked number), DNS MX lookup, plain HTTP fetch through `url-fetch.ts`. No SMTP probing and no third-party verification services.

### 2.3 Candidate sources, ordered by value for effort
| # | Source | Why | Caveat |
|---|--------|-----|--------|
| 1 | **CSV / Excel import** | Users already have lists; needs no scraping; fully legitimate | Needs column mapping and phone normalization |
| 2 | **OpenStreetMap (Overpass API)** | Free, open licence, covers businesses missing from Maps, structured category, coordinates and sometimes phone/website | Coverage uneven by region; attribution required |
| 3 | **Domain / website list** | Paste a list of sites and let enrichment do the rest | No discovery, only enrichment |
| 4 | **Local directories and marketplaces** (online business directories, marketplace seller pages) | Reaches businesses that have no Maps listing | Per-site scraper that can break; check each site's terms and robots.txt first |
| 5 | **Social profiles** (public business pages) | Many small shops live only on Instagram or Facebook | Scraping is generally against their terms; prefer import or manual add. Do not build until reviewed |

Verify before building #4 and #5: terms of use, robots.txt and local data-protection rules for each target.

### 2.4 Enrichment for leads without a website
Once sources exist, a lead with only a social profile or marketplace page can still be enriched from that public page (bio text, listed phone, product list), under the same provenance rules.

## Suggested order

1. **Phase 1, data trust** (1.1, 1.2, 1.4): `fieldMeta`, WhatsApp-registered check, website liveness, closed flag, dedupe, quality flags in Outbox. Highest value, directly answers feedback #1.
2. **Phase 2, sources foundation** (2.1, CSV import, OSM): answers feedback #2 with the lowest legal and maintenance risk.
3. **Phase 3**: staleness re-check (1.3), richer site enrichment (1.5), enrichment for leads without a website (2.4).
4. **Phase 4**: directories and marketplaces, only after a terms review.

## Work each phase must include (project conventions)
- Prisma migration plus `prisma generate`; DTOs for new endpoints.
- Unit tests for pure logic (dedupe, quality scoring, CSV mapping), including hostile inputs and time limits for any parser.
- i18n keys in both `en.ts` and `id.ts` for any new UI.
- Update `README.md`, `docs/features.md` (mark stand-in tests as "Simulated"), `docs/architecture.md` and `CHANGELOG.md` in the same change.
- Invented examples only (example.com, "Contoh Digital Agency"); no real data in fixtures.
