import type { knowledgeEn } from "./features-knowledge.en";

export const knowledgeId: Record<keyof typeof knowledgeEn, string> = {
  "nav.knowledge": "Basis pengetahuan",

  "kb.title": "Basis pengetahuan",
  "kb.subtitle": "Fakta, harga, dan kebijakan yang dipakai AI saat menulis draf. AI hanya menyebut apa yang ada di sini.",

  "kb.add": "Tambah sumber",
  "kb.add.title": "Judul",
  "kb.add.titlePlaceholder": "mis. Harga 2025, FAQ, Tentang kami",
  "kb.add.content": "Isi",
  "kb.add.contentPlaceholder": "Tempel teks yang ingin diketahui AI — harga, FAQ, deskripsi layanan, kebijakan...",
  "kb.add.kind": "Kategori",
  "kb.add.kind.text": "Umum",
  "kb.add.kind.pricing": "Harga",
  "kb.add.kind.faq": "FAQ",
  "kb.add.kind.policy": "Kebijakan",
  "kb.add.submit": "Simpan dan indeks",
  "kb.add.cancel": "Batal",

  "kb.empty": "Belum ada sumber. Tambahkan di atas agar AI bisa mengutip fakta nyata dari bisnis Anda.",
  "kb.source.chunks": "{n} potongan",
  "kb.source.chunks_plural": "{n} potongan",
  "kb.source.delete": "Hapus",
  "kb.source.delete.confirm": "Hapus sumber ini?",
  "kb.source.status.ready": "Terindeks",
  "kb.source.status.processing": "Mengindeks…",
  "kb.source.status.error": "Error",

  "kb.search": "Uji pencarian",
  "kb.search.placeholder": "Tanya sesuatu yang mungkin dicari AI…",
  "kb.search.run": "Cari",
  "kb.search.noResults": "Tidak ada hasil.",
  "kb.search.confidence": "Keyakinan",
  "kb.search.confidence.high": "Tinggi",
  "kb.search.confidence.low": "Rendah — AI akan menyebutkan bahwa hasilnya tidak pasti",
  "kb.search.confidence.none": "Tidak ada — AI tidak akan mengutip ini",

  "kb.saved": "Sumber tersimpan dan diindeks.",
  "kb.deleted": "Sumber dihapus.",
  "kb.error.add": "Gagal menyimpan sumber.",
  "kb.error.delete": "Gagal menghapus sumber.",
  "kb.error.load": "Gagal memuat basis pengetahuan.",
  "kb.error.search": "Pencarian gagal.",
};
