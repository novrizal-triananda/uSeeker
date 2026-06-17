# uSeeker
**Pelacak Lamaran Kerja dengan AI** — Kelola pencarian kerja kamu dalam satu aplikasi desktop.

uSeeker membantu kamu melacak lamaran kerja, menganalisis kecocokan CV dengan job description, meriset perusahaan, dan mempersiapkan wawancara — semuanya dari satu tempat.

## Fitur
- **Triage** — Analisis kecocokan CV kamu dengan job description. Lihat skill yang cocok dan yang gap.
- **Tailoring** — AI memberikan saran untuk menyesuaikan CV kamu agar lebih relevan dengan posisi yang dilamar.
- **Research** — Riset otomatis tentang perusahaan: profil, produk, budaya kerja, red flags, dan tips wawancara.
- **Visibility** — Pantau status lamaran kamu dalam bentuk pipeline board (Applied → Screen → Interview → Offer → Rejected).
- **Insights** — Analisis pola dari pengalaman lamaran kamu. Stage mana yang paling sering gagal? Skill apa yang kurang?
- **Data Hub** — Lihat semua data terkonsolidasi: Company Overview + Fit Score + Tailoring Suggestions dalam satu tampilan.
- **Interview Prep** — AI generate pertanyaan wawancara yang relevan dengan posisi dan profil kamu.

## Instalasi
### Windows
1. Download `uSeeker_*_en-US.msi` dari [GitHub Releases](https://github.com/novrizal-triananda/uSeeker/releases)
2. Double-click file `.msi` → ikuti petunjuk instalasi
3. Buka uSeeker dari Start Menu

### macOS
1. Download `uSeeker_*_*.dmg` (Apple Silicon) atau `uSeeker_*_*.dmg` (Intel) dari [GitHub Releases](https://github.com/novrizal-triananda/uSeeker/releases)
2. Double-click `.dmg` → drag uSeeker ke Applications
3. Buka uSeeker dari Applications

### Linux (Ubuntu/Debian)
1. Download `uSeeker_*_amd64.deb` dari [GitHub Releases](https://github.com/novrizal-triananda/uSeeker/releases)
2. Buka terminal, navigasi ke folder Downloads:
   ```bash
   cd ~/Downloads
   ```
3. Install dengan dpkg:
   ```bash
   sudo dpkg -i uSeeker_*_amd64.deb
   ```
4. Jika ada error dependency, jalankan:
   ```bash
   sudo apt-get install -f
   ```
5. Buka uSeeker dari aplikasi menu atau terminal:
   ```bash
   u-seeker
   ```

### Linux (AppImage)
1. Download `uSeeker_*_amd64.AppImage` dari [GitHub Releases](https://github.com/novrizal-triananda/uSeeker/releases)
2. Beri permission execute:
   ```bash
   chmod +x uSeeker_*_amd64.AppImage
   ```
3. Jalankan:
   ```bash
   ./uSeeker_*_amd64.AppImage
   ```

> **Catatan:** Tidak perlu install Node.js atau dependencies tambahan. Semua sudah included dalam aplikasi.

## Cara Kerja
uSeeker adalah aplikasi desktop yang dibangun dengan [Tauri v2](https://v2.tauri.app/) — ringan, cepat, dan aman.

``` 
┌─────────────────────────────────────────┐
│           uSeeker Desktop App           │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │   Frontend   │  │   Rust Backend   │  │
│  │  React + TS  │──│  Tauri Commands  │  │
│  │   Vite UI    │  │  (AI, Search,    │  │
│  │              │  │   Scrape, Agent) │  │
│  └─────────────┘  └──────────────────┘  │
│         │                    │           │
│    IndexedDB            External APIs   │
│   (data lokal)                           │
└─────────────────────────────────────────┘
```

### Arsitektur
- **Data tersimpan 100% di komputer kamu** (IndexedDB). Tidak ada data yang dikirim ke server manapun.
- **Fitur AI** membutuhkan koneksi internet untuk menganalisis CV, meriset perusahaan, dan generate pertanyaan wawancara.
- **Search** menggunakan multi-provider dengan fallback otomatis.
- **Offline** — Fitur non-AI (Triage, Pipeline, Data Hub) tetap jalan tanpa internet.

## Cek Update
Klik tombol **🔄 Cek Update** di bagian bawah sidebar untuk mengecek versi terbaru. Kalau ada update, kamu akan diarahkan ke halaman download.

## Tech Stack
- [Tauri v2](https://v2.tauri.app/) — Desktop framework (Rust + WebView)
- [React 18](https://react.dev/) + TypeScript — Frontend UI
- [Vite](https://vitejs.dev/) — Build tool
- [Dexie.js](https://dexie.org/) — IndexedDB wrapper (data lokal)
- [Rust](https://www.rust-lang.org/) — Backend proxy (AI, search, scraping)

## Privasi
uSeeker dirancang **local-first**. Semua data kamu (CV, lamaran, catatan) tersimpan di komputer kamu sendiri. Tidak ada analytics, tidak ada telemetry, tidak ada data yang dikirim ke server kami.
Fitur AI membutuhkan koneksi internet, tetapi data kamu tidak disimpan di server manapun.

## Lisensi
Belum ditentukan.

## Kontribusi
Ini adalah project personal. Jika kamu menemukan bug atau punya saran, buka [Issue](https://github.com/novrizal-triananda/uSeeker/issues).