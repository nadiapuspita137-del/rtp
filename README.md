# RTP BOLAPELANGI2

Landing page katalog game statis, responsif, dan tanpa backend. Proyek ini sekarang memiliki **Admin Panel** opsional berbasis Cloudflare Pages Functions + D1 untuk mengelola katalog tanpa mengedit `data.js` secara manual.

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

## Admin Panel

Buka `/admin/` setelah backend Cloudflare dikonfigurasi.

Admin menyediakan:

- Login admin berbasis cookie HttpOnly
- Dashboard statistik
- Tambah, edit, nonaktifkan, dan hapus game
- Ubah nama, provider, RTP, gambar, status aktif, status pilihan, dan urutan game
- Tambah, edit, nonaktifkan, dan hapus provider
- Pengaturan access URL dan waktu pembaruan data
- Database persisten menggunakan Cloudflare D1
- Seed otomatis dari `data.js` saat database masih kosong

## Arsitektur

```text
Website publik -> /api/data -> Cloudflare Pages Function -> D1
Admin Panel    -> /api/*    -> Cloudflare Pages Function -> D1
```

Jika API belum tersedia, halaman publik tetap memiliki fallback ke `data.js` sehingga deployment lama tidak langsung rusak.

## Menjalankan secara lokal

Untuk frontend statis saja:

```bash
npx serve .
```

Untuk menguji Pages Functions + D1 secara lokal, gunakan Wrangler dan binding D1 sesuai konfigurasi Cloudflare.

## Deploy Cloudflare

Cloudflare Pages Functions berjalan dari folder `/functions`. Pages Functions mendukung binding D1, sehingga database dapat dipakai langsung dari `context.env.DB`.

1. Buat database D1, misalnya `rtp-bolapelangi2`.
2. Salin `wrangler.example.toml` menjadi konfigurasi Wrangler yang sesuai dan masukkan `database_id` milikmu.
3. Jalankan migrasi `migrations/0001_schema.sql` pada database produksi.
4. Pada Cloudflare Pages, tambahkan D1 binding dengan nama **`DB`** jika tidak memakai konfigurasi Wrangler.
5. Tambahkan secret **`ADMIN_PASSWORD`**.
6. Tambahkan secret **`SESSION_SECRET`** dengan nilai acak panjang.
7. Deploy ulang Pages project.
8. Buka `/admin/`, login, lalu kelola katalog.

Cloudflare Pages Functions mendukung D1 melalui binding, dan environment variables/secrets dapat dikonfigurasi dari dashboard Cloudflare.

## Catatan keamanan

Jangan menyimpan password admin, API token, atau credential Cloudflare di file frontend. Admin Panel menggunakan password sebagai secret server-side dan session cookie `HttpOnly`, `Secure`, serta `SameSite=Strict`.

## Deploy alternatif

Untuk Cloudflare Pages gunakan framework preset `None` dan output directory `/` bila deployment dilakukan dari dashboard. Folder `functions` harus tetap berada di root repository agar Pages mengenali Functions.
