# Business Leads AI - Panduan Penggunaan / User Guide

## 🚀 Cara Memulai / Getting Started

### 1. Instalasi / Installation

```bash
npm install
npm run setup    # Jalankan wizard setup interaktif / Run interactive setup wizard
```

### 2. Setup Wizard

Wizard setup akan memandu Anda melalui:

| Step | Deskripsi                                                           | Description                      |
| ---- | ------------------------------------------------------------------- | -------------------------------- |
| 1    | Konfigurasi API (OpenAI key)                                        | API configuration                |
| 2    | Profil bisnis (nama, telepon, email, deskripsi, value propositions) | Business profile                 |
| 3    | Info pemilik / contact person                                       | Owner / contact info             |
| 4    | Preferensi (bahasa, lokasi default)                                 | Preferences (language, location) |
| 5    | Fokus industri                                                      | Industry focus                   |
| 6    | Gaya kampanye                                                       | Campaign style                   |

Semua data disimpan ke `business-profile.json` dan `.env`.

### 3. Buka Browser / Open Browser

Kunjungi / Visit: `http://localhost:3000`

```bash
npm run web    # Jalankan web dashboard
```

## 📱 Fitur Utama / Main Features

### Dashboard Utama / Main Dashboard

- **Total Kampanye / Campaigns**: Jumlah kampanye yang sudah dibuat
- **Total Leads**: Jumlah leads yang berhasil dikumpulkan
- **Priority Leads**: Leads berkualitas tinggi
- **Rata-rata Skor / Avg Score**: Kualitas leads secara keseluruhan

### Profil Bisnis / Business Profile

File `business-profile.json` menyimpan semua data bisnis Anda:

- **Nama & tipe bisnis** — digunakan di semua prompt AI
- **Telepon, email, website** — otomatis di template marketing
- **Value propositions** — keunggulan bisnis Anda
- **Target industries** — industri sasaran kampanye
- **Bahasa / Language** — Indonesian atau English
- **Gaya kampanye** — Conservative / Balanced / Aggressive

> 💡 **Tip**: Jalankan `npm run setup` kapan saja untuk update profil bisnis Anda.

### Membuat Kampanye Baru / Creating a Campaign

1. Klik tombol **"New Campaign"**
2. Isi form:
   - **Nama Kampanye**: Misal "Restaurant Jakarta Q1 2024"
   - **Industri**: Pilih dari dropdown
   - **Lokasi**: Area target (Jakarta, Bandung, dll)
   - **Search Query**: Kata kunci pencarian
   - **Jumlah Leads**: Target leads yang diinginkan
   - **Gaya Kampanye**: Balanced/Aggressive/Conservative
   - **Layanan Anda**: Deskripsi singkat produk/jasa (otomatis dari profil)

3. Klik **"Create Campaign"**

### Mengelola Leads / Managing Leads

1. Masuk ke tab **"Leads"**
2. Pilih kampanye dari dropdown
3. Filter berdasarkan:
   - **Priority Level**: Kualitas leads
   - **Minimum Score**: Skor minimal

### Export Kontak / Export Contacts

- **CSV**: Untuk spreadsheet
- **JSON**: Untuk aplikasi lain
- **vCard**: Langsung simpan ke kontak HP ⭐

## 📞 Export Kontak ke HP / Export to Phone

### Format vCard

Setiap lead bisa di-export sebagai file `.vcf`:

1. Pilih lead yang diinginkan
2. Klik **"Export vCard"**
3. File akan otomatis ter-download
4. Buka file di HP untuk menyimpan kontak

### Isi Kontak vCard / vCard Contents:

- Nama bisnis
- Nomor telepon
- Alamat lengkap
- Website (jika ada)
- Rating Google Maps
- Catatan khusus

## 💻 CLI Usage

```bash
# Scraping saja / Scraping only
node index.js -q "Restaurant Jakarta" -l 20

# Dengan marketing / With marketing
node index.js -q "Coffee Shop Bandung" -l 10 -m "Sistem ordering online"

# Bahasa Inggris / English output
node index.js -q "Coffee Shop Sydney" -l 10 -L english
```

## 🔧 Tips Penggunaan / Tips

### Kampanye Efektif / Effective Campaigns

- Gunakan kata kunci spesifik
- Mulai dengan 10-20 leads untuk testing
- Fokus pada leads dengan skor >70

### Manajemen Leads / Lead Management

- Hubungi priority leads dalam 24 jam
- Gunakan template AI yang sudah dibuat
- Update status leads secara berkala

### Mobile Usage

- Dashboard responsive untuk HP
- Export vCard langsung dari mobile
- Notifikasi real-time

## ❓ Troubleshooting

### Dashboard Tidak Muncul / Dashboard Not Loading

- Pastikan server berjalan (`npm run web`)
- Cek port 3000 tidak digunakan aplikasi lain
- Refresh browser

### Tidak Ada Data / No Data

- Buat kampanye terlebih dahulu
- Tunggu proses scraping selesai
- Periksa koneksi internet

### Export Gagal / Export Failed

- Pastikan ada data untuk di-export
- Coba format export yang berbeda
- Periksa permission download browser

## 📱 Kontak Support / Support

- GitHub Issues untuk bug report
- Email: support@businessleads.ai

---

_Panduan penggunaan Business Leads AI Dashboard / User guide for Business Leads AI Dashboard_
