# RTP BOLAPELANGI2

Landing page katalog game statis, responsif, dan tanpa build step. Sekarang tersedia juga admin panel opsional berbasis Cloudflare Pages Functions + D1 untuk mengelola katalog.

## Fitur publik

- Pencarian nama game dan provider
- Filter provider berbentuk carousel
- Pengurutan nama dan indikator RTP
- Kartu game responsif dengan lazy-loading gambar
- Modal panduan pola yang aksesibel
- Banner carousel otomatis
- Tombol muat lebih banyak
- Navigasi khusus mobile
- Informasi 18+ dan penjelasan bahwa indikator bukan jaminan hasil

## Admin panel

Buka `/admin/` setelah deployment untuk:

- Melihat statistik katalog
- Menambah, mengedit, menghapus game
- Mengubah persentase RTP
- Mengatur provider
- Mengatur gambar, status aktif, status pilihan/hot, dan urutan game
- Menambah, mengedit, menghapus provider
- Mengatur Access URL dan waktu pembaruan

## Menjalankan secara lokal

Tidak perlu proses build untuk frontend. Jalankan server statis dari folder proyek, misalnya:

```bash
npx serve .
```

Untuk fitur admin persisten, gunakan Cloudflare Pages Functions dan D1.

## Deploy Cloudflare

1. Buat database Cloudflare D1.
2. Bind database ke Pages project dengan nama `DB`.
3. Set secret `ADMIN_PASSWORD`.
4. Set secret `SESSION_SECRET` dengan nilai acak yang panjang.
5. Deploy project.

Endpoint `/api/data` akan membuat schema dan melakukan seed dari `data.js` ketika tabel game masih kosong.

Salin `wrangler.example.toml` ke konfigurasi Cloudflare milikmu dan isi ID database yang benar. Jangan commit secret asli.

## Struktur data

Frontend mempertahankan fallback ke `data.js`, sehingga katalog tetap dapat ditampilkan sebelum backend D1 dikonfigurasi. Setelah D1 aktif, perubahan melalui admin panel dibaca oleh website melalui `/api/data`.
