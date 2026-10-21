# Cara Setup Stripe Cloudflare Worker

Fail `worker.js` ini adalah backend selamat untuk mengendalikan pembayaran Stripe (Kad Debit/Kredit & FPX Online Banking Malaysia) bagi website **AFNAN LANGKAWI TOUR & TRANSPORT WITH DRIVER**.

---

### Langkah 1: Cipta Worker di Cloudflare (2 Minit Sahaja)
1. Pergi ke [Cloudflare Dashboard](https://dash.cloudflare.com/) dan log masuk.
2. Di menu sebelah kiri, klik **Workers & Pages**.
3. Klik butang **Create application** (atau **Create Worker**).
4. Berikan nama worker, contohnya: `afnan-stripe-checkout`.
5. Klik **Deploy**.

---

### Langkah 2: Masukkan Kod `worker.js`
1. Di halaman worker anda tadi, klik butang **Edit code** (Quick Edit).
2. Padam semua kod asal dalam editor tersebut.
3. Buka fail [`cloudflare-worker/worker.js`](worker.js), **Copy semua kod** dan **Paste** ke dalam editor Cloudflare.
4. Klik **Deploy** (atau Save and Deploy) di sudut atas kanan.

---

### Langkah 3: Masukkan `STRIPE_SECRET_KEY` dalam Cloudflare Secrets
Ini langkah paling penting untuk keselamatan:
1. Kembali ke halaman worker `afnan-stripe-checkout`.
2. Klik tab **Settings** -> **Variables and Secrets** (atau **Variables**).
3. Di bawah bahagian **Secrets** (atau Environment Variables), klik **Add**.
4. Masukkan:
   - **Variable name**: `STRIPE_SECRET_KEY`
   - **Value**: Masukkan Secret Key dari akaun Stripe anda:
     - Untuk Live: Bermula dengan `sk_live_...`
     - Untuk Ujian (Test): Bermula dengan `sk_test_...`
5. Klik **Deploy** / **Save**.

---

### Langkah 4: Salin URL Worker ke `index.html`
1. Salin pautan worker anda, contohnya:  
   `https://afnan-stripe-checkout.your-subdomain.workers.dev`
2. Buka fail `index.html`, cari baris:
   ```javascript
   var STRIPE_WORKER_URL = 'https://afnan-stripe-checkout.YOUR-NAME.workers.dev';
   ```
3. Gantikan dengan URL worker sebenar anda.
4. Siap! Pelanggan kini boleh klik bayar terus menggunakan Kad Debit/Kredit, FPX (Maybank, CIMB, Bank Islam, dll.), Apple Pay, atau Google Pay secara selamat.
