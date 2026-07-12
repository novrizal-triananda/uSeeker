# Changelog

Semua perubahan signifikan uSeeker akan didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id-ID/).

---

## [Unreleased]

---

## [2.3.2] - 2026-07-12

### Ditambahkan
- Triage: catatan user ("Catatan tambahan opsional") sekarang tampil di card dan expanded detail
- Visibility: kanban columns scrollable per-stage (maxHeight + overflowY) untuk menangani 100+ lamaran

### Diperbaiki
- Triage: catatan user tidak ditampilkan meski sudah tersimpan ke database

---

## [2.3.1] - 2026-07-10

### Ditambahkan
- Sistem tema 3 pilihan: Terang, Gelap, dan Pink
- Pengaturan tema di halaman Pengaturan
- Deteksi tema system preference secara otomatis
- Input/textarea menggunakan warna tema di semua halaman
- Konsistensi model wajib di semua halaman dan dokumen

### Diperbaiki
- Select dropdown menggunakan appearance:none + warna tema
- Dark mode input styling di semua halaman

---

## [2.3.0] - 2026-07-10

### Ditambahkan
- Hint text Model ditambahkan contoh: deepseek-chat, gpt-4o, gemini-2.0-flash

### Diperbaiki
- Versi Cargo.toml (2.1.7) disinkronkan dengan package.json (2.3.0)
- Input/textarea pakai warna tema di semua halaman

---

## [2.2.0] - 2026-06-22

### Ditambahkan
- Dark mode penuh untuk semua komponen UI
- FitScore bar dengan warna dinamis
- Logo dan branding uSeeker

### Diperbaiki
- CSS variables untuk semua warna tema
- PDF text reconstruction dari scan/gambar

---

## [2.1.7] - 2026-06-18

### Diperbaiki
- CI: gunakan macos-latest untuk semua target macOS
- macOS x86_64 build — pakai macos-13 (Intel) + tambah --target

---

## [2.1.6] - 2026-06-18

### Diperbaiki
- openUrl() helper — auto https:// + error logging

---

## [2.1.5] - 2026-06-18

### Diperbaiki
- Pakai Tauri shell plugin untuk buka URL eksternal

---

## [2.1.4] - 2026-06-17

### Diperbaiki
- Semua hardcoded colors → CSS variables + sourceUrl display

---

## [2.1.3] - 2026-06-17

### Diperbaiki
- PDF text items: reconstruct line breaks dari Y-coordinate grouping

---

## [2.1.2] - 2026-06-17

### Diperbaiki
- Select dropdown pakai warna tema di semua halaman

---

## [2.1.1] - 2026-06-17

### Diperbaiki
- Input/textarea pakai warna tema di semua halaman

---

## [2.1.0] - 2026-06-17

### Ditambahkan
- Data Hub: tampilan terpadu Company Overview + Fit Score + Tailoring
- Fit Score: gap analysis skill matched vs missing
- Company Research: multi-page scraping dengan DuckDuckGo fallback

### Diperbaiki
- Pipeline stats: response rate calculation

---

## [2.0.6] - 2026-06-16

### Diperbaiki
- Resume diff: highlight perubahan CV yang disarankan

---

## [2.0.3] - 2026-06-16

### Note
- Release internal pertama
- Tidak tersedia untuk publik

---

[2.3.2]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.3.2
[2.3.1]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.3.1
[2.3.0]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.3.0
[2.2.0]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.2.0
[2.1.7]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.7
[2.1.6]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.6
[2.1.5]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.5
[2.1.4]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.4
[2.1.3]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.3
[2.1.2]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.2
[2.1.1]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.1
[2.1.0]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.0
