# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-11

> Draf awal dari kode, README, `docs/features.md`, `docs/editions.md`, dan riset di `/Users/a/projects/research-alatpintar-2026-10.md` serta `plan-alatpintar-os-2026-10.md`. Yang bertanda **[ISI]** belum ada datanya dan harus diisi pemilik. Tidak ada angka, pelanggan, atau testimoni yang dikarang. Daftar pesaing berasal dari cuplikan hasil Google 2026-10-09 dan belum diverifikasi di situs masing-masing.

## Product Overview
**One-liner:** AI yang mencari calon pelanggan di Google Maps, menulis pesan pertama dengan gaya bahasa Anda, dan mengirimnya lewat WhatsApp atau email setelah Anda setujui. *(draf, perlu diuji lewat skill `copywriting`)*
**What it does:** Membaca situs atau dokumen penawaran Anda lalu menyusun brief pemasaran. Mencari bisnis lokal di Google Maps, menilai kecocokannya dengan penawaran Anda, dan menulis draf pesan dari data nyata bisnis itu. Setiap pesan menunggu persetujuan Anda, lalu terkirim satu per satu dengan batas kecepatan. Balasan dan follow-up juga menjadi draf.
**Product category:** Otomasi outreach dan prospecting (AI sales outreach), WhatsApp-first. Orang mencari: "cari calon pelanggan Google Maps", "kirim WhatsApp ke calon klien", "alternatif Apollo open source".
**Product type:** SaaS terkelola + open source (AGPL-3.0-or-later, self-host gratis, lisensi komersial tersedia). Nama produk saat ini Prospex; akan menjadi alatpintar.id.
**Business model:** Hosted di alatpintar.id: trial dan langganan langsung di situs. Paket `starter`/`pro`/`business` sudah ada namanya di kode. **[ISI] harga, lama trial, apa yang ada di tiap paket.** Dua jalur WhatsApp: Baileys (perangkat tertaut) dan WhatsApp resmi (Cloud API, hanya langganan; konektor belum dibuat). Pelanggan boleh memakai nomor sendiri atau nomor yang disediakan; harganya berbeda.

## Target Audience
**Target companies:** Pelaku usaha dan penyedia jasa yang menjual ke bisnis lokal: agensi digital, software house, freelancer, vendor software untuk UMKM (contoh pemilik sendiri: asiifdev.com menjual jasa, invly.id menjual SaaS rental). Pasar global (bintang repo banyak dari luar negeri), awal Indonesia. **[ISI] ukuran dan segmen yang ingin dikejar lebih dulu.**
**Decision-makers:** Pemilik usaha atau pendiri yang menjual sendiri; kepala bisnis di agensi kecil. **[ISI] verifikasi lewat percakapan dengan calon pengguna.**
**Primary use case:** Mendapat percakapan penjualan baru dengan bisnis lokal tanpa menulis ratusan pesan satu per satu dan tanpa risiko nomor diblokir karena broadcast.
**Jobs to be done:**
- Menemukan daftar calon pelanggan yang relevan di kota tertentu.
- Menulis pesan pertama yang terasa personal dan terdengar seperti saya.
- Menindaklanjuti yang diam dan membalas yang menjawab, tanpa ada yang terlewat.
**Use cases:**
- Penyedia jasa web/AI menyasar bisnis tanpa situs atau situs lemah di satu kota.
- Vendor SaaS niche (rental kamera, kebaya) menyasar pemilik bisnis yang belum memakai sistem booking.
- Pemilik beberapa bisnis memakai satu login dengan workspace terpisah per bisnis.

## Personas
B2B kecil, biasanya pembeli dan pengguna adalah orang yang sama. Tabel persona ditunda sampai ada data pengguna.
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Pemilik/penjual solo | Dapat klien cepat, nomor aman | Waktu habis untuk menulis pesan | Draf siap setujui dalam suaranya sendiri |
| Agensi kecil | Banyak klien, banyak akun | Outreach tidak konsisten | Satu login, workspace per klien/bisnis |
| Developer self-host | Kontrol dan biaya | Tidak mau data di SaaS | Open source, jalankan sendiri |

## Problems & Pain Points
**Core problem:** Menjual ke bisnis lokal butuh ratusan pesan pertama dan follow-up. Alat yang ada menyembunyikan kerja di balik pengirim massal, atau menyerahkan semua penulisan kepada Anda.
**Why alternatives fall short:**
- Pengirim massal WhatsApp (Wamaps-style): nomor berisiko diblokir; pesan seragam.
- Scraper Maps saja: hanya menghasilkan daftar, tanpa pesan dan tindak lanjut.
- CRM/alat enterprise (Apollo, Qontak): berat dan tidak WhatsApp-first untuk pasar lokal. **[VERIFIKASI]**
- Menulis sendiri: lambat dan tidak terukur.
**What it costs them:** Waktu, nomor WhatsApp yang diblokir, peluang hilang karena follow-up terlupa. **[ISI] angka dari pengguna nyata.**
**Emotional tension:** Takut dianggap spam, takut nomor utama hangus, malas menulis pesan dingin. **[ISI] bahasa aslinya.**

## Competitive Landscape
(Dari SERP 2026-10-09; detail belum diverifikasi.)
**Direct:** LeadAce (outbound otonom, SaaS + open source), Verdict (alternatif Apollo open source), DenchClaw. Indonesia: Wamaps, WazapSuite, Cekat.AI. Kekurangan menurut posisi kami: **[VERIFIKASI]** sebelum dipakai di copy.
**Secondary:** Scraper Maps (Outscraper, Apify, LeadStal) dan CRM/email open source (EspoCRM, Twenty, Mautic, n8n). Menyelesaikan sebagian rantai, bukan penulisan dan persetujuan pesan.
**Indirect:** Menulis manual di WhatsApp dan spreadsheet; jasa scraping di Fastwork.

## Differentiation
**Key differentiators:** (hanya yang sungguh ada di produk, lihat `docs/features.md`)
- Persetujuan manusia sebelum setiap pesan; kirim satu per satu, bukan broadcast.
- Belajar gaya bahasa dari ekspor chat WhatsApp resmi Anda (opsional, tanpa menyimpan chat mentah).
- Tidak pernah mengarang lead atau bukti; fakta di draf harus ada di sumber Anda.
- Pengaman nomor: batas per jam dan hari, jam tenang, STOP permanen, jeda otomatis saat gagal.
- Open source dan bisa di-host sendiri; juga tersedia terkelola.
- Satu login untuk banyak bisnis; kunci AI dan brief terpisah per workspace.
**How we do it differently:** AI mengerjakan pengetikan, manusia memutuskan.
**Why that's better:** Pesan terasa personal, risiko blokir lebih rendah, dan tanggung jawab tetap di pengguna.
**Why customers choose us:** **[ISI] dari alasan pengguna nyata.**

## Objections
| Objection | Response |
|-----------|----------|
| "Apakah nomor saya aman?" | Tidak ada jaminan. Baileys tidak resmi; kami menyarankan nomor khusus bisnis, batas rendah, mulai kecil. Jalur WhatsApp resmi akan tersedia di langganan. |
| "Apakah ini spam / legal?" | Persetujuan manusia, opt-out mutlak, tautan berhenti berlangganan. Kepatuhan (UU PDP, GDPR) tetap tanggung jawab pengguna; bukan nasihat hukum. |
| "Apakah balasannya terdengar seperti bot?" | Ejaan baku, gaya dari chat Anda, dan Anda yang menyetujui. **[ISI] bukti nyata dari uji pengguna.** |
**Anti-persona:** Pencari pengirim massal ribuan pesan per hari; pengguna yang tidak mau meninjau pesan; bisnis dengan niat spam.

## Switching Dynamics
**Push:** Nomor diblokir, menulis manual terlalu lama, alat lama tidak mengurus follow-up.
**Pull:** Draf siap setujui, brief otomatis dari situs sendiri, bisa self-host gratis atau terkelola.
**Habit:** Spreadsheet dan WhatsApp manual; alat scraper lama.
**Anxiety:** Takut diblokir, takut AI salah bicara, ragu pada produk baru. **[ISI]**

## Customer Language
**How they describe the problem:** **[ISI] kutipan asli belum ada.** Jangan dikarang.
**How they describe us:** **[ISI]**
**Words to use:** cari calon pelanggan, draf, setujui, satu per satu, suara Anda, nomor aman, open source.
**Words to avoid:** "otomatis penuh", "AI yang bekerja di operasional, bukan di slide" (ditolak pemilik), "garansi tidak diblokir", angka tanpa sumber, "revolusioner".
**Glossary:**
| Term | Meaning |
|------|---------|
| Outbox | Antrean draf yang menunggu persetujuan |
| AI Style | Profil gaya tulis dari ekspor chat |
| Marketing Brief | Ringkasan penawaran yang diedit pengguna |
| Workspace | Satu bisnis dengan datanya sendiri |

## Brand Voice
**Tone:** Lugas, jujur, tenang. Mengakui batas.
**Style:** Fakta dulu; "Anda" (bukan "kamu"); tanpa em dash di copy pendek; tanpa pola "bukan X, tapi Y".
**Personality:** Jujur, praktis, hati-hati, teknis tapi mudah dipahami.

## Proof Points
**Metrics:** **[ISI]** Belum ada metrik hasil. Yang boleh disebut: repo open source dengan ±211 bintang (data 2026-10-09, cek ulang sebelum dipakai).
**Customers:** **[ISI]** Pengguna pertama adalah pemilik sendiri (asiifdev.com, invly.id); belum ada pelanggan luar.
**Testimonials:** Belum ada.
**Value themes:**
| Theme | Proof |
|-------|-------|
| Aman untuk nomor | Batas kirim, jam tenang, STOP, circuit breaker (teruji dengan provider palsu; 1 pesan nyata terkirim dan 1 balasan nyata diterima) |
| Tidak mengarang | Scraper gagal = kampanye gagal; bukti di brief harus bersumber |
| Suara Anda | Teruji pada ekspor chat nyata pemilik (2.368 pesan) |

## Goals
**Business goal:** Pelanggan berlangganan alatpintar.id, plus bintang dan adopsi repo open source sebagai pintu masuk.
**Conversion action:** Mulai trial gratis, lalu berlangganan, langsung di alatpintar.id. **[ISI] definisi trial.**
**Current metrics:** Search Console alatpintar.id (3 bulan, per 2026-10-09): 3 klik, 721 tayangan, posisi rata-rata 50 (itu untuk situs tools gratis lama). Metrik produk: belum ada.

## Changelog
*Newest first. One line per revision: what changed and why.*
- v1 (2026-10-11) — Initial context, auto-drafted from code, docs and prior research. Items marked [ISI] need owner input; no invented data.
