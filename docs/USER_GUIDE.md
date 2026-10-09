# Prospex — User Guide

Panduan lengkap penggunaan Prospex dari instalasi hingga close deals pertama.

---

## Daftar Isi

1. [Instalasi & Setup](#1-instalasi--setup)
2. [Konfigurasi AI Provider](#2-konfigurasi-ai-provider)
3. [Membuat Campaign](#3-membuat-campaign)
4. [Memantau Progress Scraping](#4-memantau-progress-scraping)
5. [Mengelola Leads](#5-mengelola-leads)
6. [Gaya AI: pesan dengan suara Anda](#6-gaya-ai-pesan-dengan-suara-anda)
7. [Kotak Keluar dan WhatsApp](#7-kotak-keluar-dan-whatsapp)
8. [CRM Pipeline](#8-crm-pipeline)
9. [Analytics](#9-analytics)
10. [Export Leads](#10-export-leads)
11. [Settings & API Keys](#11-settings--api-keys)
12. [Troubleshooting](#12-troubleshooting)

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
OPENAI_API_KEY=sk-your-key-here   # boleh dikosongkan: fitur AI mati, scraping dan scoring tetap jalan
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small   # untuk Gaya AI dan basis pengetahuan
```

### Jalankan infrastruktur

```bash
# Mulai PostgreSQL (dengan pgvector) + Redis
docker compose up -d

# Terapkan migrasi database
pnpm --filter @prospex/database db:deploy
pnpm --filter @prospex/database exec prisma generate
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

Prospex mendukung penyedia AI mana pun yang kompatibel dengan API OpenAI. Draf pesan membutuhkan **model chat**, sedangkan Gaya AI dan basis pengetahuan juga membutuhkan **model embedding** (`EMBEDDING_MODEL`).

> **Penting:** saat ini penyedia AI diatur lewat file `.env` server (`OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL`, `EMBEDDING_MODEL`). Form di **Settings → AI Configuration** menyimpan kunci terenkripsi per workspace, tetapi fitur AI belum membacanya. Memakainya per workspace ada di roadmap. Setelah mengubah `.env`, restart API.

### OpenAI

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

### OpenRouter (akses Claude, Gemini, Llama, dll.)

```env
OPENAI_API_KEY=sk-or-v1-...
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=anthropic/claude-haiku-4-5
```

OpenRouter tidak menyediakan embedding yang cocok untuk semua model, jadi periksa apakah `EMBEDDING_MODEL` yang Anda pilih tersedia.

### Ollama (lokal, gratis, offline)

```bash
ollama pull gemma4              # model chat
ollama pull qwen3-embedding     # model embedding
```

```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=gemma4
EMBEDDING_MODEL=qwen3-embedding
```

Model lokal butuh sekitar 40 detik per draf (tergantung perangkat). Chat Anda tidak keluar dari mesin Anda.

> **Tanpa AI key:** scraping, scoring (berbasis aturan), CRM, analytics, dan export tetap berfungsi penuh. Fitur AI (draf pesan, Gaya AI, basis pengetahuan) tidak aktif. Prospex tidak mengisinya dengan teks template.

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

## 6. Gaya AI: pesan dengan suara Anda

Fitur ini opsional, tapi membuat draf terdengar seperti Anda, bukan seperti asisten AI. Buka menu **Gaya AI**.

### Cara mengekspor chat

Di WhatsApp: buka sebuah chat, lalu **Lainnya → Ekspor chat → Tanpa media**. Hasilnya file `.txt` (atau `.zip`). Ulangi untuk beberapa percakapan, terutama dengan pelanggan. Makin banyak percakapan, makin akurat.

### Langkah di Prospex

1. Letakkan file ekspor di kotak unggah, lalu klik **Baca file**.
2. Pilih nama Anda dari daftar pengirim (yang paling banyak menulis sudah terpilih).
3. Klik **Pelajari gaya saya**. Dengan model lokal (Ollama) ini bisa memakan beberapa menit.
4. Coba di kotak **Coba satu pesan**: tempel pesan pelanggan dan lihat draf serta jejaknya (kebiasaan yang dipakai, contoh balasan Anda yang mirip, fakta yang ditemukan).

### Apa yang disimpan

Statistik cara menulis Anda dan pasangan "pesan pelanggan → balasan Anda" yang sudah dianonimkan (nomor, email, dan tautan diganti). **Chat asli tidak disimpan.** Tombol **Hapus** menghapus semuanya. Detail dan hasil uji ada di [ai-style.md](ai-style.md) (bahasa Inggris).

Butuh minimal 30 pesan Anda sendiri. Kalau Anda mengganti model embedding di pengaturan server, impor ulang chat Anda.

### Draf WhatsApp dan pesan lain

Pesan WhatsApp tidak lagi dibuat otomatis saat scraping. Draf dibuat dari menu **Kotak Keluar** (bagian 7), memakai data nyata lead (rating, jumlah ulasan, belum punya website), gaya Anda, dan basis pengetahuan Anda. Di halaman detail lead tetap ada catatan email, LinkedIn, dan telepon yang dibuat AI untuk lead prioritas HIGH, kalau penyedia AI sudah diatur. Tanpa penyedia AI, Prospex tidak menampilkan teks bawaan.

---

## 7. Kotak Keluar dan WhatsApp

Menu **Kotak Keluar** adalah tempat semua pesan keluar. Prinsipnya: **setiap pesan berawal sebagai draf dan tidak terkirim sebelum Anda setujui.**

### Hubungkan WhatsApp

1. Klik **Hubungkan WhatsApp**. Kode QR muncul.
2. Di ponsel: WhatsApp → **Pengaturan → Perangkat tertaut → Tautkan perangkat**, lalu pindai.
3. Status berubah menjadi "Terhubung sebagai +62…".

Gunakan **nomor khusus bisnis**. Koneksi perangkat tertaut tidak resmi, dan WhatsApp bisa membatasi nomor yang dianggap otomatis. Prospex menurunkan risikonya, tapi tidak bisa menghilangkannya.

### Membuat dan meninjau draf

1. Tab **Tinjau** → pilih kampanye dan jumlah (maksimal 200) → **Buat draf**. Penulisan berjalan di latar belakang, jadi Anda boleh meninggalkan halaman. Model lokal butuh sekitar 40 detik per draf.
2. Untuk setiap draf: **Setujui**, **Sunting** (ubah teksnya dulu), atau **Tolak**. Tombol **Setujui semua** meminta konfirmasi dulu.
3. Draf yang bertanda kuning perlu dibaca teliti: memuat tautan, harga, diskon, atau teks yang terbaca seperti perintah untuk AI.
4. Yang disetujui pindah ke tab **Antrean** dan dikirim satu per satu. Anda masih bisa mengeluarkannya dari antrean.

Lead yang nomornya tidak valid, sudah pernah dihubungi, atau sudah berhenti dilewati otomatis. Setiap pesan pertama dan tindak lanjut diakhiri baris "balas STOP".

### Kecepatan pengiriman

Klik **Batas** untuk mengatur:

| Pengaturan | Bawaan | Catatan |
|-----------|--------|---------|
| Pesan per jam | 10 | 1 sampai 30. Makin rendah makin aman. |
| Pesan per hari | 80 | Sampai 200 |
| Jam tenang | 21:00 sampai 07:00 | Pesan menunggu sampai jam tenang selesai |
| Zona waktu | Asia/Jakarta | |
| Kode negara bawaan | 62 | Dipakai untuk nomor yang ditulis tanpa kode negara |

Jeda antar pesan diacak (0,6 sampai 1,4 kali rata-rata), dan "mengetik…" ditampilkan dulu sebelum tiap pesan terkirim. Dengan pengaturan bawaan, daftar 1.500 lead selesai sekitar **19 hari**. Menaikkan batas harian ke 140 mempercepatnya menjadi sekitar 11 hari. Mulailah dengan 30 sampai 50 lead, lihat berapa yang membalas dan apakah nomor tetap sehat, baru naikkan.

Prospex otomatis menjeda pengiriman setelah 3 kegagalan berturut-turut. Tombol **Jeda pengiriman** juga ada kalau Anda ingin berhenti sendiri.

### Balasan dan tindak lanjut

- **Lead membalas**: statusnya menjadi "Replied", tindak lanjut yang tertunda dibatalkan, dan **draf balasan** muncul di tab Tinjau dengan pesan pelanggan dikutip di atasnya. Anda tetap yang menyetujui.
- **Pelanggan menulis STOP** (atau "berhenti", "unsubscribe", dan sejenisnya): nomornya diblokir permanen dan semua pesan yang menunggu dibatalkan.
- **Lead diam**: Prospex membuat draf tindak lanjut setelah 3 hari, dan satu lagi 5 hari kemudian. Maksimal dua. Tombol **Cek tindak lanjut** menjalankannya sekarang.
- Pesan dari nomor yang tidak dikenal disimpan tapi tidak dijawab.

### Tab "Perlu perhatian"

Berisi pesan yang gagal, misalnya "Number is not on WhatsApp" (nomor itu tidak bisa dihubungi) atau kegagalan kirim. **Coba lagi** muncul untuk yang layak dicoba ulang. Pesan yang terputus saat server restart ditandai gagal dan **tidak dikirim ulang otomatis**, karena mungkin sudah terkirim. Cek WhatsApp dulu.

Penjelasan teknis lengkap: [whatsapp-outbox.md](whatsapp-outbox.md) (bahasa Inggris).

---

## 8. CRM Pipeline

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

## 9. Analytics

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

## 10. Export Leads

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

## 11. Settings & API Keys

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

## 12. Troubleshooting

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
pnpm --filter @prospex/database db:deploy
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

### Kode QR WhatsApp tidak muncul atau terus "Menghubungkan…"

- Pastikan server bisa keluar ke internet (WhatsApp Web memakai WebSocket).
- Klik **Putuskan**, lalu **Hubungkan WhatsApp** lagi. Kode berganti setiap beberapa detik; pindai yang terbaru.
- Cek `WHATSAPP_DISABLED` di `.env`: nilai `true` mematikan WhatsApp.
- Lihat log API untuk pesan `WhatsApp closed (code …)`. Setelah 8 percobaan sambung ulang, Prospex berhenti dan menampilkan galatnya di Kotak Keluar.

### Pesan disetujui tapi tidak terkirim

Periksa berurutan: (1) status harus "Terhubung" dan pengiriman tidak dijeda, (2) apakah sedang jam tenang, (3) batas per jam atau per hari sudah tercapai (lihat meter "Jam ini" dan "Hari ini"), (4) jeda acak antar pesan belum lewat. Tab **Antrean** menunjukkan urutannya, dan panel WhatsApp menampilkan jam tenang serta meter batas jam ini dan hari ini.

### Harus scan QR lagi setiap deploy

Sesi WhatsApp disimpan di `WA_AUTH_DIR`. Di produksi, direktori itu harus berada di volume persisten (`docker-compose.prod.yml` sudah memasang volume `wa_auth`).

### Reset database (development)

```bash
pnpm --filter @prospex/database exec prisma migrate reset   # menghapus data dan menerapkan ulang semua migrasi
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
