# Changelog

Semua perubahan signifikan uSeeker akan didokumentasikan di file ini.

Format berdasarkan [Keep a Changelog](https://keepachangelog.com/id/1.1.0/),
dan proyek ini mengikuti [Semantic Versioning](https://semver.org/lang/id-ID/).

---

## [Unreleased]

### Ditambahkan
- Sistem tema 3 pilihan: Terang, Gelap, dan Pink
- Pengaturan tema di halaman Pengaturan
- Deteksi tema system preference secara otomatis
- Persistensi tema menggunakan localStorage
- Komponen AiIndicator untuk status AI
- Test suite E2E untuk parsing CV

### Diubah
- Semua warna hardcoded dikonversi ke CSS variables untuk mendukung tema
- Pipeline status: Applied → Screen → Interview → Offer (menghapus tahap Rejected)
- Formulir Triage ditambahkan field Employment Type (Full-time/Part-time/Internship/Freelance/Contract)
- Badge lokasi, salary, dan employment type di semua tab

### Diperbaiki
- CSS variables spacing, typography, dan radius yang hilang dipulihkan

---

## [2.2.0] - 2026-06-22

### Added
- Halaman **Pengaturan AI** — user bisa mengatur Base URL dan API key sendiri (BYOK)
- Helper `aiConfig.ts` untuk membaca config dari backend secara terpusat
- Command Tauri `get_ai_config` untuk mengambil semua config AI sekaligus

### Changed
- AI API key **tidak lagi di-embed** dalam binary. User wajib memasukkan API key mereka sendiri
- Halaman Setup disederhanakan: Base URL + API Key + Model (opsional)
- Resolve chain di Rust diperbarui: runtime param > config.json > env var > fallback default
- Tidak ada lagi hardcoded `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, atau model name

### Removed
- Embedded compile-time API keys (`USEEKER_AI_API_KEY`, `USEEKER_AI_BASE_URL`, `USEEKER_AI_MODEL`)
- Provider dropdown di Setup — semua provider cukup isi Base URL sendiri

### Security
- Repository dipindah ke **public** untuk mendukung mekanisme update
- Semua API key lama dari GitHub Releases dihapus

---

## [2.1.7] - 2026-06-18

### Fixed
- Spinner animasi tidak berputar di Windows (WebView2) — diganti dari CSS `@keyframes` ke SVG `<animateTransform>` native
- Tombol "Ganti CV" warna lebih jelas (primary color) untuk diferensiasi dari section tags

### Changed
- Dots animasi "Memproses..." diubah dari CSS `content` property ke JavaScript `setInterval` (lebih kompatibel)

---

## [2.1.6] - 2026-06-18

### Fixed
- Percobaan fix spinner dengan CSS class — **tidak berhasil** di Windows WebView2

> Release ini dihapus dari GitHub karena fix belum sempurna.

---

## [2.1.5] - 2026-06-18

### Fixed
- Spinner animasi: tambah `willChange: 'transform'` ke inline style
- Loading dots: ganti CSS animation ke JavaScript `setInterval`

> Release ini dihapus dari GitHub karena fix belum sempurna.

---

## [2.1.4] - 2026-06-17

### Fixed
- CI workflow: tambah `contents:write` permission untuk release creation
- CI workflow: tambah `tagName` ke `tauri-action` untuk upload assets

### Added
- Auto-update via `tauri-plugin-updater` — app cek update otomatis dari GitHub Releases

---

## [2.1.3] - 2026-06-17

### Fixed
- Icon, loading spinner, Linux install instructions
- Versi binary sesuai dengan release tag
- Baca versi app secara dinamis untuk update checker

---

## [2.1.2] - 2026-06-17

### Fixed
- Align `tauri.conf.json` version dengan release tag

---

## [2.1.1] - 2026-06-17

### Fixed
- Versi binary sekarang sesuai dengan release tag

---

## [2.1.0] - 2026-06-17

### Added
- **Dashboard** — Ringkasan status aplikasi, quick actions, recent jobs & applications
- **Triage** — Import CV (.docx), tambah lowongan, generate fit scores (skill/experience/preference matching)
- **Research** — Company intel: AI-powered web scraping, red flags, culture, interview tips
- **Tailoring** — AI-powered CV vs JD diff, skill gap analysis, tailoring suggestions
- **Visibility** — Kanban pipeline (Applied → Screen → Interview → Offer → Rejected)
- **Insights** — Analytics: outcome distribution, stage leakage, skill gap frequency
- **Data Hub** — Consolidated view, interview prep, AI-generated interview questions
- Auto-update via `tauri-plugin-updater`
- Keyboard navigation (1-6 untuk page navigation, Escape untuk close modal)
- Offline indicator
- Drag & drop CV import
- Multi-provider AI: DeepSeek, OpenRouter, OpenAI, Anthropic, Custom/self-hosted
- Multi-provider web search: DuckDuckGo → Brave → Bing (fallback chain)
- 100% local data storage (IndexedDB via Dexie.js)

### Changed
- Server proxy Node.js digantikan oleh Rust Tauri IPC backend (`proxy.rs`)
- API keys di-embed via compile-time injection (`option_env!()`) dari GitHub Secrets

### Removed
- PDF import (hanya .docx dan .txt yang didukung)
- Node.js server proxy (digantikan Rust backend)

---

## [2.0.6] - 2026-06-16

### Note
- Release internal untuk dogfood testing
- Tidak tersedia untuk publik

---

## [2.0.3] - 2026-06-16

### Note
- Release internal pertama
- Tidak tersedia untuk publik

---

[2.2.0]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.2.0
[2.1.7]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.7
[2.1.6]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.6
[2.1.5]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.5
[2.1.4]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.4
[2.1.3]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.3
[2.1.2]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.2
[2.1.1]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.1
[2.1.0]: https://github.com/novrizal-triananda/uSeeker/releases/tag/v2.1.0
