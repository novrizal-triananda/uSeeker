# Kontribusi ke uSeeker

Terima kasih sudah tertarik untuk berkontribusi! 🎉

## Prasyarat

- [Node.js](https://nodejs.org/) v20 atau lebih baru
- [Rust](https://rustup.rs/) (stable)
- [pnpm](https://pnpm.io/) v9 atau lebih baru
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/): `cargo install tauri-cli`

## Setup Development

```bash
# Clone repository
git clone https://github.com/novrizal-triananda/uSeeker.git
cd uSeeker

# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Jalankan dalam mode development
pnpm tauri dev
```

## Panduan Coding

- **Bahasa Indonesia** untuk komentar kode dan dokumentasi
- **TypeScript** — hindari `any` kecuali benar-benar diperlukan
- **Inline styles** — project ini menggunakan React inline styles, bukan CSS modules atau Tailwind
- **Minimal code** — jangan over-engineer. Kalau bisa 10 baris, jangan 50 baris
- **Test** — tambahkan test untuk fitur baru. Jalankan `pnpm test` sebelum commit

## Proses Pull Request

1. Fork repository ini
2. Buat branch baru dari `main`: `git checkout -b feat/nama-fitur`
3. Commit perubahan dengan pesan yang jelas
4. Push ke fork kamu: `git push origin feat/nama-fitur`
5. Buka Pull Request ke branch `main`

### Tips

- Jangan commit file `.env`, `.keys/`, atau data sensitif lainnya
- Pastikan `pnpm build` dan `pnpm test` berhasil sebelum buka PR
- Jelaskan perubahan apa dan kenapa di deskripsi PR

## Laporkan Bug

Buka [GitHub Issues](https://github.com/novrizal-triananda/uSeeker/issues) dengan:
- Judul yang jelas dan singkat
- Langkah-langkah untuk mereproduksi bug
- Screenshot jika memungkinkan
- Informasi OS dan versi uSeeker
