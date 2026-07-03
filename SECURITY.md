# Kebijakan Keamanan — uSeeker

## Komitmen Keamanan

Keamanan data pengguna adalah prioritas utama uSeeker. Kami dirancang dengan prinsip **local-first** — semua data kamu tetap di komputer kamu.

## Model Ancaman

uSeeker adalah aplikasi desktop yang berjalan secara lokal. Berikut yang kami lindungi:

| Yang Dilindungi | Bagaimana |
|---|---|
| **CV / Resume kamu** | Disimpan di database lokal (IndexedDB). Tidak pernah dikirim ke server manapun. |
| **Data lamaran kerja** | Semua data pelamaran tetap di komputer kamu. |
| **API Key AI** | Disimpan di `~/.config/useeker/config.json`. Hanya kamu yang memiliki akses. |
| **Riset perusahaan** | Semua riset tersimpan lokal di browser kamu. |

## Yang Perlu Diketahui

- **Tidak ada telemetry** — uSeeker tidak mengirim data penggunaan ke mana pun.
- **Tidak ada akun** — Tidak perlu daftar atau login. Semua fitur berjalan offline.
- **Data tidak keluar dari komputer** — Kecuali kamu secara aktif menggunakan fitur AI (yang memerlukan API key milikmu sendiri), tidak ada data yang dikirim ke internet.
- **Open source** — Kode sumber tersedia secara publik. Siapa saja bisa memverifikasi klaim keamanan ini.

## Melaporkan Kerentanan

Jika kamu menemukan kerentanan keamanan di uSeeker, **jangan publikasikan di GitHub Issues yang terbuka**.

### Langkah Pelaporan

1. Buka [GitHub Issues](https://github.com/novrizal-triananda/uSeeker/issues/new)
2. Beri label **"security"** atau sebutkan "keamanan" di judul
3. Jelaskan kerentanan secara detail
4. Sertakan langkah-langkah untuk mereproduksi

### Yang Terjadi Setelah Pelaporan

- Kami akan mengakui laporan dalam 48 jam
- Perbaikan akan diprioritaskan berdasarkan tingkat keparahan
- Kamu akan diberi tahu ketika perbaikan sudah tersedia

## Daftar Keamanan

Rilis keamanan akan diterbitkan di [Releases](https://github.com/novrizal-triananda/uSeeker/releases) dengan label **"security"**.

## Terima Kasih

Terima kasih telah membantu menjaga keamanan uSeeker untuk semua pengguna. 🙏
