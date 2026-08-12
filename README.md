# RTP BOLAPELANGI2

Landing page katalog game statis, responsif, dan tanpa backend. Dibangun dengan HTML, CSS, dan JavaScript murni agar cepat serta mudah dipasang di GitHub Pages, Cloudflare Pages, atau Vercel.

## Fitur

- Pencarian nama game dan provider
- Filter provider berbentuk carousel
- Pengurutan nama dan indikator RTP
- Kartu game responsif dengan lazy-loading gambar
- Modal panduan pola yang aksesibel
- Banner carousel otomatis
- Tombol muat lebih banyak
- Navigasi khusus mobile
- Informasi 18+ dan penjelasan bahwa indikator bukan jaminan hasil

## Menjalankan secara lokal

Tidak perlu proses build. Jalankan server statis dari folder proyek, misalnya:

```bash
npx serve .
```

Lalu buka alamat lokal yang ditampilkan.

## Deploy

Untuk Cloudflare Pages gunakan konfigurasi berikut:

- Framework preset: `None`
- Build command: kosong
- Output directory: `/`

Semua data katalog berada di `data.js`. Tampilan berada di `styles.css`, sedangkan interaksi berada di `app.js`.
