# Prospex — User Guide

Panduan lengkap penggunaan Prospex dari instalasi hingga close deals pertama.

---

## Daftar Isi

1. [Instalasi & Setup](#1-instalasi--setup)
2. [Konfigurasi AI Provider](#2-konfigurasi-ai-provider)
3. [Membuat Campaign](#3-membuat-campaign)
4. [Memantau Progress Scraping](#4-memantau-progress-scraping)
5. [Mengelola Leads](#5-mengelola-leads)
6. [Menggunakan AI Outreach Content](#6-menggunakan-ai-outreach-content)
7. [CRM Pipeline](#7-crm-pipeline)
8. [Analytics](#8-analytics)
9. [Export Leads](#9-export-leads)
10. [Settings & API Keys](#10-settings--api-keys)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Instalasi & Setup

### Prasyarat

- Node.js 20+ (disarankan 22 LTS)
- pnpm 9+ — `npm install -g pnpm`
- Docker Desktop

> **Stack:** Next.js 16, NestJS 10, PostgreSQL 16, Redis 7

### Langkah instalasi

```bash
# Clone repo
git clone https://github.com/asiifdev/business-leads-ai-automation.git
cd business-leads-ai-automation

# Install semua dependencies
pnpm install

# Salin file konfigurasi
cp .env.example apps/api/.env
cp .env.example packages/database/.env
```

Edit `apps/api/.env` minimal dengan:

```env
DATABASE_URL="postgresql://prospex:prospex@localhost:5432/prospex"
OPENAI_API_KEY=sk-your-key-here   # boleh dikosongkan, AI akan pakai mock
```

### Jalankan infrastruktur

```bash
# Mulai PostgreSQL + Redis
docker compose up -d

# Push database schema
pnpm --filter @prospex/database db:push
```

### Jalankan aplikasi

Buka dua terminal:

```bash
# Terminal 1 — Backend API (port 3001)
pnpm --filter @prospex/api dev

# Terminal 2 — Dashboard (port 3000)
pnpm --filter @prospex/web dev
```

Buka browser: **http://localhost:3000**

---

## 2. Konfigurasi AI Provider

Prospex mendukung berbagai AI provider via API OpenAI-compatible.

Masuk ke **Settings → AI Configuration**.

### OpenAI

```
API Key  : sk-proj-...
Model    : gpt-4o-mini
Base URL : (kosongkan)
```

### OpenRouter (akses Claude, Gemini, Llama, dll.)

```
API Key  : sk-or-v1-...
Model    : anthropic/claude-haiku-4-5
Base URL : https://openrouter.ai/api/v1
```

### Ollama (local, gratis, offline)

```bash
ollama pull llama3.2   # download model dulu
```

```
API Key  : ollama
Model    : llama3.2
Base URL : http://localhost:11434/v1
```

> **Tanpa AI key:** Prospex tetap berfungsi penuh — AI scoring pakai algoritma berbasis rules, konten marketing pakai template default.

---

## 3. Membuat Campaign

Campaign adalah unit kerja utama di Prospex. Satu campaign = satu batch pencarian leads.

### Langkah

1. Klik **Campaigns** di sidebar
2. Klik tombol **New Campaign**
3. Isi form:

| Field | Contoh | Keterangan |
|-------|--------|------------|
| Campaign Name | "Restaurant Jakarta Q3 2026" | Nama untuk identifikasi |
| Industry | Restaurant & F&B | Kategori bisnis target |
| Location | Jakarta Selatan | Kota/area target |
| Search Queries | "restaurant halal jakarta selatan" | Kata kunci pencarian, bisa lebih dari satu |
| Your Service | "Sistem kasir digital & website" | Deskripsi jasa/produk yang ditawarkan |
| Max Results | 20 | Jumlah leads target (1–100) |
| Content Style | Balanced | Gaya bahasa AI: Professional / Friendly / Casual |
| Language | Indonesian | Bahasa output konten AI |

4. Klik **Start Campaign** — sistem langsung mulai scraping + AI scoring

### Tips search query efektif

- Spesifik lokasi: `"warung makan jakarta timur"` lebih baik dari `"warung makan"`
- Tambah multiple query untuk coverage lebih luas
- Gunakan nama daerah spesifik: `"salon kecantikan menteng"`, `"salon kecantikan kuningan"`

---

## 4. Memantau Progress Scraping

Setelah campaign dibuat, halaman detail campaign menampilkan progress secara real-time.

### Status campaign

| Status | Warna | Arti |
|--------|-------|------|
| `draft` | Abu-abu | Belum dimulai |
| `running` | Biru + spinner | Sedang scraping & scoring |
| `completed` | Hijau | Selesai, leads tersedia |
| `failed` | Merah | Error, cek log API |

### Progress bar

Progress diupdate otomatis setiap 2 detik:

- **0–30%** — Inisialisasi & scraping
- **30–60%** — AI scoring semua leads
- **60–95%** — Generate konten marketing untuk HIGH priority leads
- **100%** — Selesai

---

## 5. Mengelola Leads

### Halaman Leads

Masuk ke **Leads** di sidebar untuk melihat semua leads dari semua campaign.

**Filter tersedia:**
- Search by name/address
- Priority: HIGH / MEDIUM / LOW
- CRM Status: New / Contacted / Replied / Meeting / Won / Lost

### Prioritas leads

Skor AI (0–100) menentukan prioritas:

| Score | Priority | Artinya |
|-------|----------|---------|
| 75–100 | HIGH | Segera hubungi — potensi tinggi |
| 55–74 | MEDIUM | Masuk sequence standar |
| 0–54 | LOW | Hubungi kalau kapasitas ada |

### Faktor yang mempengaruhi skor

- Kelengkapan data (nomor HP, website, alamat)
- Rating Google Maps (4.5+ = bonus besar)
- Industri target (cafe, tech, healthcare = skor lebih tinggi)
- Lokasi (Jakarta, Bali = bonus)
- Tidak punya website = peluang digital (bonus kecil)

---

## 6. Menggunakan AI Outreach Content

Klik lead manapun untuk melihat detail + konten AI yang sudah digenerate.

### Konten yang digenerate per lead

**Email** — subject + body 100–150 kata, personal, menyebut nama bisnis + rating mereka

**WhatsApp** — pesan 50–80 kata, bisa pakai emoji, tone friendly

**Instagram DM** — pesan 40–60 kata, casual, cocok untuk slide into DMs

**LinkedIn** — connection note under 280 karakter, professional

**Cold Call** — opening 2–3 kalimat untuk telpon langsung

### Tips pakai konten AI

- Konten sudah dipersonalisasi per bisnis — jangan kirim persis sama ke semua lead
- Edit sedikit sebelum kirim agar terasa lebih natural
- Gunakan tombol **Copy** di setiap section
- HIGH priority leads sudah punya konten lengkap; MEDIUM/LOW perlu di-generate manual kalau mau

---

## 7. CRM Pipeline

### Update status lead

Di halaman detail lead, panel **CRM Status** di kanan:

1. Pilih status baru dari dropdown
2. Klik **Update Status**

Status otomatis mencatat timestamp (misal: `contactedAt`, `repliedAt`, `closedAt`).

### Alur CRM yang disarankan

```
New → Contacted → Replied → Meeting → Proposal → Won
                                                 ↘ Lost
```

| Status | Kapan digunakan |
|--------|----------------|
| **New** | Baru ditemukan, belum dihubungi |
| **Contacted** | Sudah kirim pesan/email pertama |
| **Replied** | Prospek sudah reply/response |
| **Meeting** | Sudah jadwal meeting/demo |
| **Proposal** | Sudah kirim penawaran |
| **Won** | Deal closed, jadi customer |
| **Lost** | Tidak jadi, tolak, atau tidak respon |

### Activity Log

Setiap perubahan status otomatis tercatat di **Activity Log** di panel kanan lead detail. Ini membantu tracking history komunikasi.

---

## 8. Analytics

Masuk ke **Analytics** di sidebar.

### Metrics utama

- **Total Leads** — seluruh leads dari semua campaign
- **Conversion Rate** — persentase leads yang jadi Won
- **Deals Won** — jumlah deal berhasil ditutup
- **Active Campaigns** — campaign yang running atau completed

### Chart

**Leads by Industry** — bar chart jumlah leads + average score per industri. Berguna untuk tahu industri mana paling banyak leads berkualitas.

**CRM Funnel** — pie chart distribusi leads di setiap stage pipeline. Kalau banyak di "Contacted" tapi sedikit "Replied", artinya pesan kurang engaging.

---

## 9. Export Leads

### Dari Campaign Detail

Di halaman `/campaigns/:id`, ada 3 tombol export:

| Format | Kegunaan |
|--------|----------|
| **CSV** | Import ke Excel, Google Sheets, CRM lain |
| **JSON** | Integrasi ke aplikasi / automation (Zapier, n8n) |
| **vCard** | Import langsung ke kontak HP / Outlook |

### Dari Leads List

Di halaman `/leads`, tombol **Export CSV** di pojok kanan atas mengexport semua leads.

### Format vCard

File `.vcf` bisa langsung dibuka di HP untuk save kontak:
- Nama bisnis
- Nomor telepon
- Alamat lengkap
- Website
- AI Score + Priority (di field Notes)

---

## 10. Settings & API Keys

### AI Configuration

**Settings → AI Configuration** — simpan OpenAI key, model, dan base URL. Data tersimpan di database (bukan file `.env`), jadi bisa diupdate live tanpa restart.

### Prospex API Keys

Untuk mengakses Prospex API dari tools eksternal (Zapier, n8n, custom scripts):

1. Settings → **Prospex API Keys**
2. Isi nama key (misal: "Zapier", "Production")
3. Klik **+**
4. **Salin key yang muncul sekarang** — tidak akan ditampilkan lagi
5. Gunakan sebagai Bearer token: `Authorization: Bearer px_...`

### Hapus API Key

Klik ikon trash di sebelah kanan key yang ingin dihapus. Key langsung non-aktif.

---

## 11. Troubleshooting

### API tidak bisa connect (frontend error)

```
Error: Failed to fetch http://localhost:3001/api/...
```

Pastikan API sudah jalan:
```bash
pnpm --filter @prospex/api dev
# Harus lihat: "Prospex API running on http://localhost:3001"
```

### Database error saat start API

```
Error: Can't reach database server at localhost:5432
```

Pastikan Docker berjalan:
```bash
docker compose up -d
docker ps   # harus ada prospex_db dan prospex_redis
```

### Campaign stuck di "running"

Refresh halaman — kalau masih running padahal sudah lama, restart API:
```bash
# Ctrl+C di terminal API, lalu:
pnpm --filter @prospex/api dev
```

### Prisma error setelah update schema

```bash
pnpm --filter @prospex/database db:push
pnpm --filter @prospex/database exec prisma generate
```

### Port 3000 atau 3001 sudah dipakai

```bash
# Cari proses yang pakai port
lsof -i :3000
lsof -i :3001

# Kill prosesnya
kill -9 <PID>
```

### Reset database (development)

```bash
pnpm --filter @prospex/database exec prisma migrate reset
pnpm --filter @prospex/database db:push
```

---

## Shortcut Berguna

| Aksi | Cara |
|------|------|
| Campaign baru | `/campaigns/new` |
| Lihat semua leads | `/leads` |
| Swagger API docs | `http://localhost:3001/api/docs` |
| Database browser | `pnpm --filter @prospex/database db:studio` |
| Export semua leads | `GET http://localhost:3001/api/export/leads/csv` |

---

_Prospex — open-source AI GTM automation platform_
