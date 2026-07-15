# Kebijakan Keamanan — uSeeker

## Prinsip

uSeeker dirancang *local-first*. Semua data pengguna disimpan di komputer masing-masing. Tidak ada server uSeeker yang menyimpan data pengguna.

## Apa yang Disimpan Lokal

| Data | Lokasi | Dikirim ke Internet? |
|------|--------|---------------------|
| CV / Resume | JSON file (lokal) | Tidak, kecuali saat dianalisis oleh AI |
| Data lamaran kerja | JSON file (lokal) | Tidak |
| Hasil riset perusahaan | JSON file (lokal) | Tidak |
| Skor kecocokan | JSON file (lokal) | Tidak |

## Fitur AI dan Privasi

Fitur AI uSeeker (analisis CV, riset perusahaan, *tailoring*, pertanyaan wawancara) bekerja dengan cara mengirim data ke **provider AI pilihan pengguna**.

- **Data yang dikirim ke provider AI:** Teks CV dan/atau deskripsi pekerjaan. Bergantung pada provider yang dipilih — bisa ke server DeepSeek (China), OpenAI (AS), atau provider lainnya.
- **Data yang TIDAK pernah keluar dari komputer:** Semua data yang disimpan di JSON file (Rust backend) — CV asli, daftar lamaran, catatan, hasil riset, dan skor.
- **Jika menggunakan Ollama atau provider lokal:** Data tetap 100% di komputer pengguna. Tidak ada yang keluar ke internet.

**Pengguna bertanggung jawab memahami kebijakan privasi provider AI yang mereka pilih.**

## API Key

- API key disimpan di `~/.config/useeker/config.json` dalam bentuk teks biasa.
- API key tidak pernah dikirim ke server uSeeker (tidak ada server uSeeker).
- API key hanya dikirim ke provider AI yang ditunjuk pengguna saat fitur AI dijalankan.

## Tanpa Telemetri

- Tidak ada analytics, tidak ada pelacakan penggunaan, tidak ada laporan telemetri.
- Tidak ada akun atau registrasi yang diperlukan.

## Melaporkan Kerentanan

Jika menemukan kerentanan keamanan, buka [GitHub Issues](https://github.com/novrizal-triananda/uSeeker/issues/new) dengan label "security" atau sebutkan "keamanan" di judul.

Karena ini proyek yang dikelola oleh pengembang tunggal, tidak ada jangka waktu pasti untuk respons. Namun, setiap laporan akan dibaca dan ditanggapi sebaik mungkin berdasarkan ketersediaan pengembang.

## Open Source

Kode sumber tersedia secara publik di [GitHub](https://github.com/novrizal-triananda/uSeeker). Siapa saja dapat memverifikasi klaim keamanan di atas.