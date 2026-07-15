# uSeeker

**Pelacak Lamaran Kerja dengan AI** — Kelola pencarian kerja kamu dalam satu aplikasi desktop.

uSeeker membantu kamu melacak lamaran kerja, menganalisis kecocokan CV dengan job description, meriset perusahaan, dan mempersiapkan wawancara — semuanya dari satu tempat, langsung di komputer kamu.

---

## Fitur

| Fitur | Penjelasan |
|-------|-----------|
| **Dashboard** | Ringkasan keseluruhan pencarian kerja kamu — jumlah lamaran, skor kecocokan rata-rata, dan lowongan terbaru. |
| **Triage** | Unggah CV dan job description, lalu dapatkan analisis kecocokan secara instan. Lihat skill yang cocok dan skill yang perlu diasah (*gap analysis*). |
| **Research** | Riset otomatis tentang perusahaan: profil, produk, budaya kerja, *red flags*, dan tips wawancara. |
| **Tailoring** | AI memberikan saran untuk menyesuaikan CV kamu agar lebih relevan dengan posisi yang dilamar — termasuk saran perbaikan CV (*resume diff*). |
| **Visibility** | Pantau status lamaran kamu dalam bentuk *pipeline board*: Applied → Screen → Interview → Offer, dengan hasil akhir (Accepted / Rejected / Ghosted / Withdrawn). |
| **Insights** | Analisis pola dari pengalaman lamaran kamu. Stage mana yang paling sering gagal? Skill apa yang kurang? |
| **Data Hub** | Lihat semua data terkonsolidasi: Company Overview + Fit Score + Tailoring Suggestions dalam satu tampilan terpadu. |
| **Pengaturan** | Konfigurasi API key AI dan pilih tema tampilan: Terang, Gelap, atau Pink. |

### Fitur yang tidak butuh internet

Beberapa fitur uSeeker bisa digunakan **sepenuhnya offline**:

- Dashboard (ringkasan data lokal)
- Visibility (pipeline management)
- Data Hub (tampilan konsolidasi data)

Fitur yang membutuhkan koneksi internet: Research, Tailoring, Insights, dan analisis AI di Triage.

---

## Download & Install

Download versi terbaru dari [**GitHub Releases**](https://github.com/novrizal-triananda/uSeeker/releases).

### Windows

1. Buka halaman [Releases](https://github.com/novrizal-triananda/uSeeker/releases) di browser
2. Cari file `.msi` (contoh: `uSeeker_2.3.0_x64_en-US.msi`)
3. Klik untuk mengunduh
4. **Double-click** file `.msi` yang sudah diunduh
5. Ikuti petunjuk instalasi (klik **Next** → **Install** → **Finish**)
6. Buka **uSeeker** dari Start Menu

> **Pertama kali buka?** Windows Defender SmartScreen mungkin memblokir aplikasi ini karena belum terverifikasi. Klik **More info** → **Run anyway** untuk melanjutkan. Ini normal untuk aplikasi indie yang belum ditandatangani secara digital.

### macOS

1. Buka halaman [Releases](https://github.com/novrizal-triananda/uSeeker/releases) di browser
2. Cari file `.dmg`
   - **Apple Silicon** (aarch64) untuk Mac M1 / M2 / M3 / M4
   - **Intel** (x64) untuk Mac lama (sebelum 2020)
3. Klik untuk mengunduh
4. **Double-click** file `.dmg`
5. **Drag** ikon uSeeker ke folder **Applications**
6. Buka **uSeeker** dari Applications

> **Pertama kali buka?** Kalau macOS bilang "tidak bisa dibuka karena developer tidak terverifikasi", klik **OK**, lalu buka **System Settings → Privacy & Security** → klik **Open Anyway** di bagian bawah.

### Linux

#### Ubuntu / Debian (.deb)

1. Buka halaman [Releases](https://github.com/novrizal-triananda/uSeeker/releases) di browser
2. Download file `.deb`
3. Buka **Terminal** (cari "Terminal" di menu aplikasi)
4. Ketik ini lalu tekan **Enter**:

   ```bash
   cd ~/Downloads && sudo dpkg -i uSeeker_*.deb
   ```

5. Kalau muncul error tentang "dependency", ketik ini lalu tekan **Enter**:

   ```bash
   sudo apt-get install -f
   ```

6. Buka **uSeeker** dari menu aplikasi, atau ketik:

   ```bash
   u-seeker
   ```

#### AppImage (semua distro Linux)

1. Download file `.AppImage` dari [Releases](https://github.com/novrizal-triananda/uSeeker/releases)
2. Buka **Terminal**, lalu ketik:

   ```bash
   cd ~/Downloads && chmod +x uSeeker_*.AppImage && ./uSeeker_*.AppImage
   ```

> Tidak perlu install Node.js atau dependency tambahan. Semua sudah included dalam aplikasi.

---

## Uninstall

### Windows

1. Buka **Settings** → **Apps** → **Installed apps**
2. Cari **uSeeker** → klik **Uninstall**
3. Ikuti petunjuk penghapusan

Atau: buka **Start Menu**, cari **uSeeker**, klik kanan → **Uninstall**

### macOS

1. Buka **Finder** → **Applications**
2. Seret ikon **uSeeker** ke **Trash** (atau klik kanan → **Move to Trash**)
3. Kosongkan **Trash** untuk menghapus permanen

### Linux

#### Ubuntu / Debian (.deb)

```bash
sudo dpkg -r useeker
```

#### AppImage

Hapus file `.AppImage` yang sudah diunduh. Tidak ada yang terinstall ke sistem.

---

## Cara Mulai (Quick Start)

### Langkah 1 — Buka Aplikasi

Setelah instalasi, buka uSeeker dari menu sistem (Start Menu / Applications / Desktop Menu).

### Langkah 2 — Siapkan API Key AI (untuk fitur AI)

Fitur AI seperti analisis kecocokan CV dan riset perusahaan membutuhkan **API key dari penyedia AI** yang kompatibel dengan OpenAI API.

1. Buka **Pengaturan** dari menu sidebar
2. Masukkan **Base URL** penyedia AI kamu (contoh: `https://api.deepseek.com`, `https://api.openai.com/v1`, `https://openrouter.ai/api/v1`)
3. Masukkan **API Key** kamu
4. Wajib: tentukan **Model** yang akan digunakan
5. Klik **Simpan Pengaturan**

> uSeeker mendukung **semua penyedia AI yang kompatibel dengan OpenAI API** — DeepSeek, OpenAI, OpenRouter, Groq, Mistral, Anthropic (via OpenRouter), Ollama (lokal), LM Studio, atau provider self-hosted lainnya. Cukup masukkan Base URL dan API Key dari provider pilihan kamu.

### Langkah 3 — Unggah CV

1. Buka **Triage** dari sidebar
2. Unggah file CV kamu (PDF atau DOCX)
3. Kamu juga bisa **drag and drop** file langsung ke area upload

### Langkah 4 — Analisis Lowongan

1. Di halaman **Triage**, paste *job description* dari lowongan yang kamu minati
2. Klik tombol analisis
3. Lihat hasilnya: skill yang cocok, skill yang kurang, dan skor kecocokan

### Langkah 5 — Pantau Lamaran

1. Buka **Visibility**
2. Tambahkan lamaran baru
3. Geser status lamaran ke stage yang sesuai: **Applied** → **Screen** → **Interview** → **Offer**
4. Tandai hasil akhir: Accepted, Rejected, Ghosted, atau Withdrawn

### Langkah 6 — Eksplorasi Fitur Lainnya

- **Research** — Riset perusahaan sebelum wawancara
- **Tailoring** — Dapatkan saran untuk menyesuaikan CV
- **Insights** — Lihat analisis pola pencarian kerja kamu
- **Data Hub** — Lihat ringkasan data lengkap per lowongan

---

## FAQ

### Apakah uSeeker gratis?

Ya! uSeeker adalah aplikasi **gratis dan open-source**. Namun, untuk fitur AI kamu perlu menyediakan API key sendiri dari penyedia AI pilihanmu.

### Apakah data saya aman?

Semua data kamu tersimpan di komputer kamu sendiri sebagai file JSON via Rust backend. Tidak ada data yang dikirim ke server uSeeker karena uSeeker tidak memiliki server.

**Yang perlu diketahui:** Saat kamu menggunakan fitur AI (analisis CV, riset perusahaan, *tailoring*), teks CV dan/atau deskripsi pekerjaan akan dikirim ke **provider AI yang kamu pilih** untuk dianalisis. Data ini dikirim langsung ke provider (contoh: DeepSeek, OpenAI) — bukan ke uSeeker. Kamu bertanggung jawab memahami kebijakan privasi provider yang kamu gunakan.

Jika kamu menggunakan provider lokal seperti **Ollama** atau **LM Studio**, data tidak keluar dari komputer kamu sama sekali.

### Apakah saya perlu internet?

- **Untuk fitur AI** (analisis CV, riset perusahaan, *tailoring*): **Ya**, butuh koneksi internet
- **Untuk fitur non-AI** (dashboard, pipeline, data hub): **Tidak**, bisa offline
- **Untuk install & update**: butuh internet sekali saja

### Bagaimana cara mendapatkan API key?

Kamu perlu mendaftar di salah satu penyedia AI yang kompatibel dengan OpenAI API. Beberapa contoh:

| Provider | Link | Keterangan |
|----------|------|------------|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | Sangat murah |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | Banyak pilihan model |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | Populer, harga bervariasi |
| **Groq** | [console.groq.com](https://console.groq.com) | Sangat cepat |
| **Ollama** (lokal) | [ollama.com](https://ollama.com) | Gratis, data tetap di komputer |

Setelah mendaftar, copy API key dari dashboard provider, lalu masukkan ke **Pengaturan** di uSeeker.

### Format CV apa yang didukung?

- **PDF** (.pdf)
- **DOCX** (.docx / Microsoft Word)

### Bisa dipakai di lebih dari satu komputer?

Bisa, tapi setiap komputer punya data tersendiri (karena data disimpan lokal). Belum ada fitur sinkronisasi otomatis antar perangkat.

### Ada bug atau saran?

Buka [**Issue di GitHub**](https://github.com/novrizal-triananda/uSeeker/issues) — laporan akan dibaca dan ditanggapi sesuai ketersediaan pengembang.

### Bagaimana cara update ke versi terbaru?

Klik tombol **Cek Update** di bagian bawah sidebar untuk mengecek versi terbaru. Kalau ada update baru, kamu akan mendapat notifikasi untuk mengunduh versi terbaru.

---

## Privasi

**uSeeker dirancang *local-first*.** Ini berarti:

- **Data lokal** — Semua data kamu — CV, lamaran kerja, catatan, skor — tersimpan di komputer kamu sendiri (JSON file via Rust backend). Tidak ada server uSeeker yang menyimpan data ini.
- **Tanpa telemetri** — Tidak ada analytics, tidak ada pelacakan penggunaan, tidak ada laporan telemetri.
- **API key milik kamu** — API key AI disimpan lokal di perangkat kamu. Hanya dikirim ke provider AI yang kamu tunjuk saat fitur AI dijalankan.
- **Koneksi AI** — Fitur AI menghubungi provider pilihan kamu langsung. uSeeker tidak menjadi perantara penyimpanan data.
- **Offline-ready** — Fitur non-AI tetap jalan tanpa internet.

---

## Tech Stack

| Komponen | Teknologi |
|----------|-----------|
| **Desktop Framework** | [Tauri v2](https://v2.tauri.app/) — Rust + WebView |
| **Frontend** | [React 18](https://react.dev/) + TypeScript |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Database Lokal** | JSON file via Rust backend (cross-platform, WebKitGTK-proof) |
| **Backend** | [Rust](https://www.rust-lang.org/) — Tauri commands (AI proxy, search, scraping) |
| **Testing** | [Vitest](https://vitest.dev/) + Testing Library |
| **File Parsing** | PDF.js, Mammoth (DOCX), Tesseract.js (OCR) |

```
┌─────────────────────────────────────────┐
│           uSeeker Desktop App           │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │   Frontend  │  │   Rust Backend   │  │
│  │  React + TS │──│  Tauri Commands  │  │
│  │   Vite UI   │  │  (AI, Search,    │  │
│  │             │  │   Scrape, Agent) │  │
│  └─────────────┘  └──────────────────┘  │
│         │                    │          │
│    JSON (Rust backend)  External APIs   │
│   (data lokal)                          │
└─────────────────────────────────────────┘
```

- **BYOK (Bring Your Own Key)** — Kamu menyediakan API key sendiri. Tidak ada API key *embedded* dalam aplikasi.
- **Search** menggunakan *multi-provider* dengan *fallback* otomatis.

---

## Kontribusi

Jika kamu menemukan bug atau punya saran, buka [**Issue**](https://github.com/novrizal-triananda/uSeeker/issues).

Kalau kamu developer dan ingin berkontribusi, lihat [**CONTRIBUTING.md**](CONTRIBUTING.md).

---

## Lisensi

[MIT License](LICENSE) — Gratis untuk digunakan, dimodifikasi, dan didistribusikan.

---

*Dibuat untuk pencari kerja Indonesia.*