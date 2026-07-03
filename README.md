# uSeeker

**Pelacak Lamaran Kerja dengan AI** — Kelola pencarian kerja kamu dalam satu aplikasi desktop.

uSeeker membantu kamu melacak lamaran kerja, menganalisis kecocokan CV dengan job description, meriset perusahaan, dan mempersiapkan wawancara — semuanya dari satu tempat, langsung di komputer kamu.

---

## 📸 Screenshot

> **Belum ada screenshot?** Tambahkan gambar screenshot di sini untuk memudahkan calon pengguna memahami tampilan aplikasi.
>
> Contoh format:
>
> ```markdown
> ![Dashboard](screenshots/dashboard.png)
> ![Triage - Analisis Kecocokan](screenshots/triage.png)
> ![Visibility - Pipeline Board](screenshots/visibility.png)
> ```

<!-- Untuk contributor: jalankan aplikasi, ambil screenshot dari setiap halaman utama, simpan di folder screenshots/, lalu uncomment baris di atas. -->

---

## 🌟 Fitur

| Fitur | Penjelasan |
|-------|-----------|
| **📊 Dashboard** | Ringkasan keseluruhan pencarian kerja kamu — jumlah lamaran, skor kecocokan rata-rata, dan lowongan terbaru. |
| **📋 Triage** | Unggah CV dan job description, lalu dapatkan analisis kecocokan secara instan. Lihat skill yang cocok dan skill yang perlu diasah (gap analysis). |
| **🔍 Research** | Riset otomatis tentang perusahaan: profil, produk, budaya kerja, *red flags*, dan tips wawancara. |
| **🎤 Tailoring** | AI memberikan saran untuk menyesuaikan CV kamu agar lebih relevan dengan posisi yang dilamar — termasuk saran perbaikan CV (*resume diff*). |
| **👁️ Visibility** | Pantau status lamaran kamu dalam bentuk *pipeline board*: Applied → Screen → Interview → Offer, dengan hasil akhir (Accepted / Rejected / Ghosted / Withdrawn). |
| **💡 Insights** | Analisis pola dari pengalaman lamaran kamu. Stage mana yang paling sering gagal? Skill apa yang kurang? |
| **🗄️ Data Hub** | Lihat semua data terkonsolidasi: Company Overview + Fit Score + Tailoring Suggestions dalam satu tampilan terpadu. |
| **⚙️ Pengaturan** | Konfigurasi API key AI dan pilih tema tampilan: Terang ☀️, Gelap 🌙, atau Pink 🌸. |

### Fitur yang tidak butuh internet

Beberapa fitur uSeeker bisa digunakan **sepenuhnya offline**:

- ✅ Dashboard (ringkasan data lokal)
- ✅ Triage (analisis kecocokan CV — tapi butuh AI untuk analisis lanjutan)
- ✅ Visibility (pipeline management)
- ✅ Data Hub (tampilan konsolidasi data)
- ❌ Research, Tailoring, Insights → butuh koneksi internet untuk AI

---

## ⬇️ Download & Install

Download versi terbaru dari [**GitHub Releases**](https://github.com/novrizal-triananda/uSeeker/releases).

### 🪟 Windows

1. Buka halaman [Releases](https://github.com/novrizal-triananda/uSeeker/releases) di browser
2. Cari file `.msi` (contoh: `uSeeker_2.2.0_x64-setup.msi`)
3. Klik untuk mengunduh
4. **Double-click** file `.msi` yang sudah diunduh
5. Ikuti petunjuk instalasi (klik **Next** → **Install** → **Finish**)
6. Buka **uSeeker** dari Start Menu

> **Screenshot hint:** Tampilkan dialog instalasi Windows.

### 🍎 macOS

1. Buka halaman [Releases](https://github.com/novrizal-triananda/uSeeker/releases) di browser
2. Cari file `.dmg`
   - **Apple Silicon** (aarch64) untuk Mac M1 / M2 / M3 / M4
   - **Intel** (x64) untuk Mac lama (sebelum 2020)
3. Klik untuk mengunduh
4. **Double-click** file `.dmg`
5. **Drag** ikon uSeeker ke folder **Applications**
6. Buka **uSeeker** dari Applications

> ⚠️ **Pertama kali buka?** Kalau macOS bilang "tidak bisa dibuka karena developer tidak terverifikasi", klik **OK**, lalu buka **System Settings → Privacy & Security** → klik **Open Anyway** di bagian bawah.

> **Screenshot hint:** Tampilkan dialog drag ke Applications.

### 🐧 Linux

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

> **Screenshot hint:** Tampilkan terminal dengan perintah instalasi.

> 💡 **Tips:** Tidak perlu install Node.js atau dependency tambahan. Semua sudah included dalam aplikasi.

---

## 🚀 Cara Mulai (Quick Start)

### Langkah 1 — Buka Aplikasi

Setelah instalasi, buka uSeeker dari menu sistem (Start Menu / Applications / Desktop Menu).

### Langkah 2 — Siapkan API Key AI (untuk fitur AI)

Fitur AI seperti analisis kecocokan CV dan riset perusahaan membutuhkan **API key dari penyedia AI** yang kompatibel dengan OpenAI API.

1. Buka **⚙️ Pengaturan** dari menu sidebar
2. Masukkan **Base URL** penyedia AI kamu:
   - DeepSeek: `https://api.deepseek.com`
   - OpenRouter: `https://openrouter.ai/api/v1`
   - OpenAI: `https://api.openai.com/v1`
3. Masukkan **API Key** kamu (contoh: `sk-...`)
4. Opsional: tentukan **Model** yang akan digunakan
5. Klik **Simpan Pengaturan**

> 💡 **Tips:** uSeeker mendukung DeepSeek, OpenRouter, OpenAI, Anthropic, atau provider lain yang kompatibel dengan API OpenAI. API key disimpan lokal di komputer kamu dan tidak pernah dikirim ke server uSeeker.

> 🔒 **Privasi:** API key kamu hanya disimpan di komputer ini. Tidak ada yang bisa mengaksesnya selain kamu.

### Langkah 3 — Unggah CV

1. Buka **📋 Triage** dari sidebar
2. Unggah file CV kamu (PDF atau DOCX)
3. Kamu juga bisa **drag and drop** file langsung ke area upload

### Langkah 4 — Analisis Lowongan

1. Di halaman **📋 Triage**, paste *job description* dari lowongan yang kamu minati
2. Klik tombol analisis
3. Lihat hasilnya: skill yang cocok, skill yang kurang, dan skor kecocokan

### Langkah 5 — Pantau Lamaran

1. Buka **👁️ Visibility**
2. Tambahkan lamaran baru
3. Geser status lamaran ke stage yang sesuai: **Applied** → **Screen** → **Interview** → **Offer**
4. Tandai hasil akhir: Accepted ✅, Rejected ❌, Ghosted 👻, atau Withdrawn 🏳️

### Langkah 6 — Eksplorasi Fitur Lainnya

- **🔍 Research** — Riset perusahaan sebelum wawancara
- **🎤 Tailoring** — Dapatkan saran untuk menyesuaikan CV
- **💡 Insights** — Lihat analisis pola pencarian kerja kamu
- **🗄️ Data Hub** — Lihat ringkasan data lengkap per lowongan

---

## ❓ FAQ

### Apakah uSeeker gratis?

Ya! uSeeker adalah aplikasi **gratis dan open-source**. Namun, untuk fitur AI kamu perlu menyediakan API key sendiri dari penyedia AI pilihanmu.

### Apakah data saya aman?

**Sangat aman.** Semua data kamu tersimpan 100% di komputer kamu sendiri (menggunakan IndexedDB lokal). Tidak ada data yang dikirim ke server uSeeker atau pihak ketiga manapun. Lihat bagian **Privasi** di bawah untuk penjelasan lengkap.

### Apakah saya perlu internet?

- **Untuk fitur AI** (analisis CV, riset perusahaan, *tailoring*): **Ya**, butuh koneksi internet
- **Untuk fitur non-AI** (dashboard, pipeline, data hub): **Tidak**, bisa offline
- **Untuk install & update**: butuh internet sekali saja

### Bagaimana cara mendapatkan API key?

Kamu perlu mendaftar di salah satu penyedia AI berikut (pilih salah satu):

| Provider | Link | Estimasi Biaya |
|----------|------|----------------|
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com) | Sangat murah |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | Banyak pilihan model |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | Populer, harga bervariasi |

Setelah mendaftar, copy API key dari dashboard provider, lalu masukkan ke **⚙️ Pengaturan** di uSeeker.

### Format CV apa yang didukung?

- **PDF** (.pdf)
- **DOCX** (.docx / Microsoft Word)

### Bisa dipakai di lebih dari satu komputer?

Bisa, tapi setiap komputer punya data tersendiri (karena data disimpan lokal). Belum ada fitur sinkronisasi otomatis antar perangkat.

### Ada bug atau saran?

Buka [**Issue di GitHub**](https://github.com/novrizal-triananda/uSeeker/issues) — kami akan membaca dan merespons sesegera mungkin.

### Bagaimana cara update ke versi terbaru?

Klik tombol **🔄 Cek Update** di bagian bawah sidebar untuk mengecek versi terbaru. Kalau ada update baru, kamu akan mendapat notifikasi untuk mengunduh versi terbaru.

---

## 🔒 Privasi

**uSeeker dirancang *local-first*.** Ini berarti:

| | |
|---|---|
| 📁 **Data lokal** | Semua data kamu — CV, lamaran kerja, catatan, skor — tersimpan **100% di komputer kamu sendiri** (IndexedDB). |
| 🚫 **Tanpa tracking** | Tidak ada analytics, tidak ada telemetry, tidak ada data usage reporting. |
| 🔑 **API key aman** | API key AI disimpan lokal di perangkat kamu. Tidak pernah dikirim ke server uSeeker. |
| 🌐 **Koneksi AI** | Fitur AI menghubungi provider pilihan kamu langsung — uSeeker tidak menjadi perantara penyimpanan data. |
| 📴 **Offline-ready** | Fitur non-AI tetap jalan tanpa internet. |

**Singkatnya: data kamu tidak akan pernah keluar dari komputer kamu.**

---

## 🛠️ Tech Stack

Bagi developer yang penasaran:

| Komponen | Teknologi |
|----------|-----------|
| **Desktop Framework** | [Tauri v2](https://v2.tauri.app/) — Rust + WebView, ringan dan aman |
| **Frontend** | [React 18](https://react.dev/) + TypeScript |
| **Build Tool** | [Vite](https://vitejs.dev/) |
| **Database Lokal** | [Dexie.js](https://dexie.org/) — IndexedDB wrapper |
| **Backend** | [Rust](https://www.rust-lang.org/) — Tauri commands (AI proxy, search, scraping) |
| **Testing** | [Vitest](https://vitest.dev/) + Testing Library |
| **File Parsing** | PDF.js, Mammoth (DOCX), Tesseract.js (OCR) |

**Arsitektur:**

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
│    IndexedDB            External APIs   │
│   (data lokal)                          │
└─────────────────────────────────────────┘
```

- **BYOK (Bring Your Own Key)** — Kamu menyediakan API key sendiri. Tidak ada API key *embedded* dalam aplikasi.
- **Search** menggunakan *multi-provider* dengan *fallback* otomatis.

---

## 🤝 Kontribusi

Ini adalah project personal. Jika kamu menemukan bug atau punya saran, buka [**Issue**](https://github.com/novrizal-triananda/uSeeker/issues).

Kalau kamu developer dan ingin berkontribusi:

1. Fork repository ini
2. Buat branch baru untuk fitur/fix kamu
3. Buat Pull Request dengan penjelasan yang jelas

---

## 📄 Lisensi

Belum ditentukan.

---

*Dibuat dengan ❤️ untuk pencari kerja Indonesia.*
