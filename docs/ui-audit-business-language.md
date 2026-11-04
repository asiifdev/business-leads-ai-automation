# UI audit: layout and business language

## Layout

| Finding | Where | Status |
|---|---|---|
| A very long line (text with no spaces) widened the page, so the content scrolled sideways and slid under the sidebar. | Brief page, `(dashboard)/layout.tsx`, `brief-sections.tsx` | Fixed: the content column can shrink (`min-w-0`), the page never scrolls sideways (`overflow-x-hidden`), long words wrap. |
| Brief fields contained leaked model text (`tool_call|```json/code.json}...`). | `apps/api/src/marketing/brief-schema.ts` | Fixed: text is cut where such a marker starts, before it is saved. Briefs saved earlier need "Buat ulang" (regenerate). |
| "[NEED: ...]" notes. | Brief page | Already shown without the brackets. |

Still to review by eye (not checked in a browser in this pass): the leads table on narrow screens, the campaign form on phones, and the sidebar when the workspace name is long.

## Wording

Rule used: a business owner should understand every label without knowing what an API, a key, an index or a server is.

| Before | After |
|---|---|
| Workspace | Bisnis / Business |
| API key, REST API, Swagger | Kunci akses, "Hubungkan ke aplikasi lain", "Panduan untuk developer" |
| Webhook / HTTP endpoint | "ke aplikasi lain secara otomatis" |
| Base URL kustom | Alamat server AI (opsional) |
| Model chat, Model embedding | Model AI untuk menulis, Model pencari |
| Diindeks / Indeks ulang | Dipelajari / Baca ulang |
| Kemiripan embedding | Tingkat kemiripan |
| Akun SMTP | Akun email bisnis |
| "Isi PUBLIC_API_URL ... restart API" | "Minta admin server mengisi alamat publik (https)" |
| "set OPENAI_API_KEY on the server" | "ask the server admin to set one" |
| WhatsApp Business Cloud API (WABA) | WhatsApp Business resmi |
| Scraping, scrape, koordinat | Pencarian, lokasi di peta |
| category=camera_store | (removed from the hint) |
| Pipeline, Analitik | Alur penjualan, Laporan |
| AI Style, knowledge base (in Indonesian text) | Gaya AI, basis pengetahuan |

## Left as is on purpose

- **Lead**: the usual word in Indonesian sales teams.
- **Brief pemasaran**, **Kampanye**, **Draf**: used across the product and the guides.
- **Overture Maps**, **Zapier**, **n8n**, **Ollama**, **OpenRouter**: product names the user must recognise to choose them.

## Follow-up (done)

- Messages from the server that reach the screen (business owners and admins, "business not found", access key not found, AI search model changed, source could not be read, email port) now use business wording.
- `docs/USER_GUIDE.md` and `docs/USER_GUIDE_EN.md` use the same names as the interface (business, access keys, sales flow, reports, search) outside code and settings names; the table of contents links were regenerated.
- The business name fallback in the switcher no longer shows a fixed English "My Workspace".

## Open items

- Layouts were not checked in a logged-in browser (leads table on narrow screens, campaign form on phones, long business names in the sidebar).
- Errors returned by an AI provider or a website are passed on as they are and can still contain technical words.
- Names of server settings (`OPENAI_API_KEY`, `PUBLIC_API_URL`) stay in the installation part of the guides, which is written for whoever runs the server.
