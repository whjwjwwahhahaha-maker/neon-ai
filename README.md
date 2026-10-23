# NEON AI — Website Chat AI

Website chat AI responsif dengan tema neon biru-ungu. Menggunakan endpoint API yang kompatibel dengan format OpenAI Chat Completions.

## Persyaratan
- Node.js 18 atau lebih baru
- API key dari penyedia AI yang endpoint-nya kompatibel
- Internet saat menjalankan chat online

## Menjalankan di Windows
1. Ekstrak ZIP.
2. Pasang Node.js LTS dari https://nodejs.org/ jika belum terpasang.
3. Buka folder `neon-ai-website`.
4. Salin `.env.example` lalu namai salinannya `.env`.
5. Buka `.env` dengan Notepad dan isi `AI_API_KEY` dengan API key milikmu.
6. Sesuaikan `AI_BASE_URL` dan `AI_MODEL` dengan penyedia API.
7. Buka Command Prompt/Terminal di folder tersebut, lalu jalankan:
   ```bash
   npm install
   npm start
   ```
8. Buka `http://localhost:3000` di browser.

Untuk menghentikan server tekan `Ctrl+C`.

## Pengaturan `.env`
- `AI_API_KEY`: kunci rahasia API. Jangan masukkan ke `public/app.js` atau unggah ke GitHub.
- `AI_BASE_URL`: default `https://api.openai.com/v1`; ubah sesuai provider.
- `AI_MODEL`: nama model yang tersedia untuk akun API-mu.
- `DAILY_MESSAGE_LIMIT`: batas pesan harian pada website per alamat IP. Angka `100` berarti maksimal 100 pesan per hari; `0` menonaktifkan batas buatan website ini.
- `MAX_OUTPUT_TOKENS`: batas panjang jawaban yang diminta dari model.
- `PORT`: port server, default 3000.
- `SYSTEM_PROMPT`: instruksi dasar untuk AI.

Sesudah mengubah `.env`, restart server. Batas API provider, kuota akun, rate limit, konteks model, dan biaya tetap berlaku meskipun `DAILY_MESSAGE_LIMIT=0`.

## Fitur
- Layout responsif HP dan komputer.
- Chat dengan AI online lewat server; API key tidak dikirim ke browser.
- Riwayat chat disimpan di `localStorage` browser.
- Chat baru, buka chat lama, dan hapus semua riwayat.
- Indikator model/koneksi serta penghitung kuota website.
- Maksimal 40 pesan terakhir dikirim sebagai konteks.

## Catatan untuk deployment publik
Versi ini adalah starter project, bukan layanan produksi multi-pengguna. Penghitung kuota disimpan di memori server dan reset saat server restart; identifikasi IP bisa berbeda di balik proxy. Untuk penggunaan publik, tambahkan login, database, rate limiting yang persisten (misalnya Redis), perlindungan abuse, HTTPS, logging yang aman, dan batas biaya di dashboard provider. Jangan mempercayai batas IP ini sebagai mekanisme keamanan tunggal.

Riwayat chat disimpan di browser pengguna, bukan database server. Penghapusan data browser atau penggunaan perangkat/browser lain akan memengaruhi riwayat yang terlihat.
