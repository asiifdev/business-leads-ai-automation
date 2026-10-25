# Lead sources

Where leads can come from, what each costs, and which sources were looked at and **not** built. Prospex is a scraping tool: the only paid dependency is your AI provider, so every source below is free to run.

## Available

| Source | What it finds | Strengths | Limits | Terms |
|--------|---------------|-----------|--------|-------|
| **Google Maps** | Businesses with a listing | Ratings, review counts, the real category | Needs the scraping browser; only businesses that have a listing | Scraping Maps is against Google's terms; this is why it can be switched off per campaign and why other sources exist |
| **OpenStreetMap** | Businesses mapped by volunteers | Free, no key; finds places that are not on Maps | Only places with a phone, website, email or Instagram/Facebook page; no ratings; coverage differs by area; the public Overpass can take about a minute | ODbL: the lead page shows "© OpenStreetMap contributors" |
| **Overture Maps** | Open place data contributed by Meta, Foursquare, Microsoft and others | Many small businesses that only have a Facebook page, most with a phone (in a test box in Bandung: 65,887 places, 78% with a phone, 38% with a website, 35% with an email) | No ratings; quality varies, so places below a confidence of 0.25 are left out (`OVERTURE_MIN_CONFIDENCE`); needs DuckDB (see below) | CDLA-Permissive-2.0, Apache-2.0 or CC0 depending on the contributor; the lead page shows "Data: Overture Maps Foundation" |
| **CSV / Excel file** | Whatever you already have | Fully yours; any source | Up to 2,000 rows and 5 MB per file | Your own data |
| **Website list** | The businesses behind websites or Instagram/Facebook pages you paste | Fully yours; finds the name and details from each page | Up to 200 per paste; does not discover anything new | Your own list |

### Overture Maps in practice

- It reads Overture's public parquet files on S3 with DuckDB, with no key. DuckDB is loaded only when the source is used: if its native binary cannot run on a machine, only this source reports it, and nothing else is affected.
- The first search after the API starts reads the files' index and takes **several minutes** (292 seconds in our test, on a home connection); later searches in the same process take seconds (1 second in the same test). For fast searches always, download a country extract once and set `OVERTURE_PLACES_URL=/data/overture/places/*.parquet`.
- The release is the latest in Overture's public catalogue, or `OVERTURE_RELEASE` (for example `2026-10-21.0`).
- DuckDB 2.0 fails with an internal error when a query both filters on `bbox.xmin` and selects `bbox.xmin`; the query selects the whole `bbox` struct instead, and a fatal error makes the next search open a fresh database. Keep both when changing the query.
- **Docker:** the API image installs dependencies on Alpine (musl) and runs on Debian (glibc), and DuckDB ships a separate native binary for each. This was not tested in a container. If Overture reports that DuckDB could not be loaded in your image, build the dependencies on the same base image as the runner.

## Reviewed and not built

Reviewed on 2026-10-25 by reading each site's robots.txt and terms. Check again before building anything for them.

| Site | Finding | Decision |
|------|---------|----------|
| **IndonesiaYP** (indonesiayp.com), the largest public business directory found | Terms of use: automated access is permitted only for search engines, and content may not be reproduced without written permission. The paid "Data Hub" terms prohibit "scraping, bulk downloading, or automated extraction" and the use of "bots, crawlers, scrapers". Contact details are sold as a separate product | Not built |
| **Tokopedia** | Terms of service: no "penggandaan ... data Situs/Aplikasi dengan teknologi otomatis atau manual tanpa adanya izin dari Tokopedia" | Not built |
| **Shopee** | robots.txt names a short list of search-engine crawlers and disallows most paths for others | Not built |
| **Bukalapak** | robots.txt restricts many paths | Not built |
| **Yellow Pages Indonesia** (yellowpages.co.id) | The site did not answer | Not built |
| TikTok profiles | The page serves no usable preview to a plain request | Not read |
| Link pages (Linktree and similar), marketplaces | Not a business's own page | Skipped on purpose |

Marketplaces also do not publish sellers' phone numbers, so there would be little to gain even with permission.

If a directory owner gives written permission, or publishes an open licence or an API, a source for it is a small addition (`LeadSource`, see [architecture.md](architecture.md)).
