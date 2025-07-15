# Business Leads AI - Panduan Penggunaan

## 🚀 Cara Memulai

### 1. Instalasi
```bash
npm install
npm run web
```

### 2. Buka Browser
Kunjungi: `http://localhost:3000`

## 📱 Fitur Utama

### Dashboard Utama
- **Total Kampanye**: Jumlah kampanye yang sudah dibuat
- **Total Leads**: Jumlah leads yang berhasil dikumpulkan
- **Priority Leads**: Leads berkualitas tinggi
- **Rata-rata Skor**: Kualitas leads secara keseluruhan

### Membuat Kampanye Baru
1. Klik tombol **"New Campaign"**
2. Isi form:
   - **Nama Kampanye**: Misal "Restaurant Jakarta Q1 2024"
   - **Industri**: Pilih dari dropdown
   - **Lokasi**: Area target (Jakarta, Bandung, dll)
   - **Search Query**: Kata kunci pencarian
   - **Jumlah Leads**: Target leads yang diinginkan
   - **Gaya Kampanye**: Balanced/Aggressive/Conservative
   - **Layanan Anda**: Deskripsi singkat produk/jasa

3. Klik **"Create Campaign"**

### Mengelola Leads
1. Masuk ke tab **"Leads"**
2. Pilih kampanye dari dropdown
3. Filter berdasarkan:
   - **Priority Level**: Kualitas leads
   - **Minimum Score**: Skor minimal

### Export Kontak
- **CSV**: Untuk spreadsheet
- **JSON**: Untuk aplikasi lain
- **vCard**: Langsung simpan ke kontak HP ⭐

## 📞 Export Kontak ke HP

### Format vCard
Setiap lead bisa di-export sebagai file `.vcf` yang bisa langsung disimpan ke kontak HP:

1. Pilih lead yang diinginkan
2. Klik **"Export vCard"**
3. File akan otomatis ter-download
4. Buka file di HP untuk menyimpan kontak

### Isi Kontak vCard:
- Nama bisnis
- Nomor telepon
- Alamat lengkap
- Website (jika ada)
- Rating Google Maps
- Catatan khusus

## 🔧 Tips Penggunaan

### Kampanye Efektif
- Gunakan kata kunci spesifik
- Mulai dengan 10-20 leads untuk testing
- Fokus pada leads dengan skor >70

### Manajemen Leads
- Hubungi priority leads dalam 24 jam
- Gunakan template AI yang sudah dibuat
- Update status leads secara berkala

### Mobile Usage
- Dashboard responsive untuk HP
- Export vCard langsung dari mobile
- Notifikasi real-time

## ❓ Troubleshooting

### Dashboard Tidak Muncul
- Pastikan server berjalan (`npm run web`)
- Cek port 3000 tidak digunakan aplikasi lain
- Refresh browser

### Tidak Ada Data
- Buat kampanye terlebih dahulu
- Tunggu proses scraping selesai
- Periksa koneksi internet

### Export Gagal
- Pastikan ada data untuk di-export
- Coba format export yang berbeda
- Periksa permission download browser

## 📱 Kontak Support
- GitHub Issues untuk bug report
- Email: support@businessleads.ai
- WhatsApp: +62-xxx-xxx-xxxx

---
*Panduan singkat untuk penggunaan Business Leads AI Dashboard*