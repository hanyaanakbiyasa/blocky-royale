# Tutorial Blocky Royale

Ikuti berurutan. Waktu kira-kira 20-30 menit. Nama menu di Firebase dan Vercel bisa sedikit berbeda dari yang tertulis karena tampilannya sering diperbarui.

## Yang dibutuhkan

- Komputer atau laptop dengan internet
- [Node.js](https://nodejs.org) versi 22 LTS
- Akun Google (untuk Firebase)
- Akun [Vercel](https://vercel.com) dan, untuk cara A, akun [GitHub](https://github.com)

## 1. Ekstrak dan coba di komputer (mode offline)

1. Ekstrak `blocky-royale.zip`.
2. Buka folder `blocky-royale` di terminal (Windows: klik kanan folder, pilih "Open in Terminal").
3. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
4. Buka `http://localhost:3000` di Chrome atau Edge.
5. Masukkan username. Game berjalan dalam mode **Offline**: data di localStorage, lawan bot.

> Jangan membuka `index.html` dengan klik ganda. Game harus dibuka lewat server.
> Internet tetap diperlukan karena Three.js dan font diambil dari CDN.

## 2. Buat project Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com), klik **Create a project**, beri nama (misal `blocky-royale`). Google Analytics boleh dimatikan.
2. **Authentication**: menu Build > Authentication > Get started > Sign-in method > **Anonymous** > Enable > Save.
3. **Firestore**: Build > Firestore Database > Create database > pilih lokasi `asia-southeast2` (Jakarta) > **production mode**.
   - Buka tab **Rules**, hapus isinya, tempel seluruh isi file `firestore.rules`, klik **Publish**.
4. **Realtime Database**: Build > Realtime Database > Create Database > lokasi Singapore (`asia-southeast1`) > **locked mode**.
   - Tab **Rules**, ganti dengan isi `database.rules.json`, klik **Publish**.
   - Salin URL database di bagian atas tab Data (diawali `https://`).
5. **Daftarkan web app**: ikon roda gigi > Project settings > General > Your apps > ikon `</>` > Register app. Catat `apiKey`, `authDomain`, `projectId`, `appId`.
6. **Service account**: Project settings > **Service accounts** > **Generate new private key**. File JSON akan terunduh.

> File JSON itu RAHASIA. Jangan dimasukkan ke GitHub, jangan dibagikan, jangan ditaruh di folder project.

## 3. Isi Environment Variables

| Nama | Diisi dengan |
|---|---|
| `FIREBASE_API_KEY` | apiKey |
| `FIREBASE_AUTH_DOMAIN` | authDomain |
| `FIREBASE_PROJECT_ID` | projectId |
| `FIREBASE_DATABASE_URL` | URL Realtime Database |
| `FIREBASE_APP_ID` | appId |
| `FIREBASE_SERVICE_ACCOUNT` | seluruh isi file JSON service account |

### Tes online di komputer (opsional)

1. Salin `.env.example` menjadi `.env`.
2. Isi semua nilai. `FIREBASE_SERVICE_ACCOUNT` harus **satu baris**. Cara termudah mengubah JSON menjadi base64 satu baris:
   ```bash
   node -e "console.log(require('fs').readFileSync(process.argv[1]).toString('base64'))" "path/ke/file-service-account.json"
   ```
3. Hentikan server (Ctrl+C), jalankan lagi `npm run dev`. Pojok kiri bawah lobby harus bertuliskan **Online**.

## 4. Deploy ke Vercel

### Cara A: lewat GitHub (disarankan)

1. Buat repository baru di GitHub (boleh Private).
2. Di folder project:
   ```bash
   git init
   git add .
   git commit -m "Blocky Royale"
   git branch -M main
   git remote add origin https://github.com/USERNAME/blocky-royale.git
   git push -u origin main
   ```
3. Di Vercel: **Add New > Project** > Import repository tadi.
4. Framework Preset: **Other**. Build Command dan Output Directory dibiarkan kosong/default.
5. Buka **Environment Variables**, masukkan 6 variabel dari tabel di atas. Isi JSON service account boleh ditempel langsung.
6. Klik **Deploy**.

### Cara B: lewat Vercel CLI

```bash
npm install -g vercel
vercel login
vercel                 # jawab pertanyaan, buat project baru
```
Tambahkan 6 variabel di Dashboard Vercel > Project > Settings > Environment Variables, lalu:
```bash
vercel --prod
```

> Setiap mengubah Environment Variables, lakukan **Redeploy**.

## 5. Periksa hasilnya

- `https://nama-kamu.vercel.app/api/config` harus menampilkan data `firebase` dan `"server": true`.
- Lobby bertuliskan **Online**.
- Spin 1x mengurangi 50 Iron, dan di Firestore muncul koleksi `users` serta `leaderboard`.
- Global Chat bisa mengirim pesan.
- Buka dari **dua perangkat berbeda** (rank sama), tekan Play hampir bersamaan (selisih di bawah 10 detik). Keduanya masuk match yang sama.

## 5b. Diagnosis koneksi Firebase

Buka `https://nama-kamu.vercel.app/api/health` (atau `http://localhost:3000/api/health`). Halaman ini menunjukkan variabel mana yang kosong dan langkah mana yang gagal, lengkap dengan petunjuk. Kalau login masih Offline, pesan penyebabnya juga muncul sebagai notifikasi saat halaman dibuka.

Penyebab tersering: Anonymous Auth belum aktif, Firestore Database belum dibuat, atau `FIREBASE_SERVICE_ACCOUNT` tertempel rusak (pakai versi base64 satu baris). Profil sekarang dibaca lewat server, jadi Rules Firestore tidak lagi menentukan login.

## 5c. Login, Register, dan Admin

- Layar awal: loading bar, lalu pilih **Guest**, **Login**, atau **Register** (username + password). Bila sudah pernah login, game langsung ke lobby setelah loading.
- Login/Register butuh mode Online. Password disimpan sebagai hash scrypt di koleksi Firestore `accounts` (tidak bisa dibaca dari browser).
- **Admin**: tambahkan dua variabel di Vercel (dan `.env` lokal), lalu Redeploy.
  1. Buat hash: `node scripts/hash.mjs "PasswordKuat123"`
  2. `ADMIN_USERNAME` = username admin, `ADMIN_PASSWORD_HASH` = hasil langkah 1 (diawali `scrypt:`).
  3. Login lewat tab **Login** dengan username dan password itu. Tombol **Admin** muncul di menu kiri.
- Panel Admin: tambah Coin/Iron/Token, ubah Rank, beri satu item (ID dari `shared/catalog.js`), atau beri semua item/bundle/skin, ke akun sendiri atau pemain lain (isi username pemain).

## 5d. Mystery Shop, emote, dan map

- **Mystery Shop**: Admin membuka Panel Admin, isi jumlah hari (default 7) dan judul, lalu tekan **Mulai**. Event disimpan di Firestore `config/mystery`. Pemain membeli barang eksklusif dengan Iron di menu **Mystery**, dan total belanja membuka hadiah otomatis (1.000, 3.000, 6.000 Iron). Daftar barang dan hadiah ada di `shared/catalog.js` (`MYSTERY_ITEMS`, `MYSTERY_MILESTONES`).
- **Emote lobby**: ketuk karakter untuk membuka menu (Melambai, Tertawa, Marah, Duduk). Skin Evo yang sudah Level MAX menambah emote final (meteor, petir, atau orbit sesuai skin), dan di akhir emote senjata itu ada di tangan karakter.
- **Pegang senjata**: menu Weapon, tombol **Pegang di tangan**.
- **Map**: ada sungai dengan jembatan, pagar, tumpukan ban, serta pickup dan truk sebagai penghalang/perlindungan (belum bisa dikendarai).

## 5e. Fitur gameplay baru

- **Lobby**: karakter berdiri di kabin pesawat 3D (jendela berawan, kursi, lampu).
- **Senjata baru**: USP, UMP, P90, G36, FAMAS, Groza, Kar98, SPAS12, masing-masing dengan suara tembakan berbeda (disintesis WebAudio). Ada 3 Gacha baru (Gurun, Kutub) berisi bundle, skin, dan Evo baru.
- **Karakter dan skill**: menu **Karakter** (Adam gratis; Uno jaring, Rena heal, Kuro lari kilat, Bolt gelombang kejut, Terra perisai, dibeli dengan Coin). Skill dipakai lewat tombol skill di dalam game (butuh Mana, ada cooldown). Skill Uno dan Bolt hanya mengenai bot atau mode offline.
- **Medkit dan Super Medkit**: ditemukan di rumah. Tombol Heal menampilkan jumlah (medkit/super); tanpa medkit tidak bisa heal. Saat heal karakter bergerak seperti memperban.
- **Scope**: semua senjata bisa pakai Scope x2. Scope x3 dan x4 ada sebagai loot di dalam rumah. Tombol Scope berganti tingkat zoom.
- **Rumah**: sekitar 18 rumah tambahan tersebar di map.
- **Kendaraan**: pickup dan truk bisa dikendarai (tombol Naik/Turun muncul di dekatnya, joystick untuk gas dan belok, bisa menabrak bot). Kendaraan hanya bisa dikendarai di mode offline.
- **Social Island**: pilih mode SOCIAL ISLAND. Tanpa senjata dan tanpa damage, ada NPC berkeliaran, tombol Emote, dan tombol Chat (Global Chat). Mode ini selalu berjalan lokal dan tidak memberi EXP.

- **Tata letak lobby**: menu Vault/Shop/Spin/Weapon/Karakter/Mystery ada di kiri (dua kolom, bisa digeser bila layar pendek) di antara kartu profil dan Global Chat. Leaderboard, Settings, dan **Log out** ada di kanan atas.

## 6. Cara bermain

| Aksi | HP | Komputer |
|---|---|---|
| Gerak | Joystick | W A S D |
| Putar kamera | Geser layar | Klik layar lalu gerakkan mouse (Esc untuk lepas), atau panah kiri/kanan |
| Tembak | Tombol merah (bisa sambil digeser untuk membidik) | Klik kiri / J |
| Lompat dari pesawat, loncat | JUMP / Loncat | Spasi / Shift |
| Jongkok / Tiarap | Tombol kiri bawah | C atau Ctrl / Z |
| Reload | Reload | R |
| Ambil barang | Tombol "Ambil" | F |
| Dash (25 mana) / Heal (40 mana) | Dash / Heal | Q / H |
| Tas | Tas | I atau Tab |
| Slot senjata | Ketuk slot | 1 2 3 |

Gunakan **C** untuk jongkok di komputer, karena Ctrl+W akan menutup tab.

Joystick kini default di kiri. Kalau lebih nyaman di kanan, ubah di **Settings > Posisi joystick**.

## 7. Aturan game

- **Ganti username**: 100 Iron.
- **Iron**: pemula 1.000, klaim harian 100 (reset 00.00 WIB). Spin 1x = 50, 10x = 300.
- **Coin**: pemula 1.000, didapat dari match, dipakai di Shop.
- **Token Evo**: dari Spin, untuk menaikkan skin Evo level 1-7. Efek Evo hanya tampilan, tidak menambah damage.
- **Spin**: 5 toko. Spin ke-40 tanpa hadiah legend di satu toko pasti memberi Bundle atau Skin Evo.
- **EXP**: dasar 50-150 sesuai peringkat, +10 per kill, +100 bila menang.
- **Rank (total EXP)**: Kroco 0, Noob 200, Golden 550, Diamond 1.100, Platinum 1.900, Super Star 3.000, Mythic 4.500, Immortal 6.500, Immortal Neon 9.500.
- **Matchmaking**: pemain asli hanya bertemu rank yang **sama**; bot ber-rank sama atau satu tingkat di bawahnya. Jadi tidak ada "bayi melawan bom atom". Menunggu sekitar 12 detik; bila tidak ada pemain lain, lawannya bot.

## 8. Mengubah isi game

| Ingin mengubah | File |
|---|---|
| Harga, item, bundle, skin, senjata, rank, peluang spin | `shared/catalog.js` |
| Hadiah harian, modal awal, rumus EXP | `shared/economy.js` |
| Bentuk peta | `js/world.js` |
| Gameplay, zona, bot | `js/game.js` |
| Tampilan | `styles.css` |

Tambah topi baru cukup satu baris di `catalog.js`:
```js
add('hat_hijau', 'hat', 'Topi Hijau', 300, { boxes: cap(0x22c55e) });
```
Setelah mengubah, jalankan `npm test`, lalu push ulang.

## 9. Masalah umum

| Gejala | Solusi |
|---|---|
| Tertulis Offline padahal sudah deploy | Cek `/api/config`; pastikan variabel terisi, Anonymous Auth aktif, lalu Redeploy |
| "Server belum dikonfigurasi" / "Kesalahan server" | Periksa `FIREBASE_SERVICE_ACCOUNT` dan log di Vercel > Logs |
| Chat gagal / pemain tidak saling bertemu | Rules Realtime Database belum di-Publish atau URL salah |
| Leaderboard gagal | Publish `firestore.rules` |
| Layar tertahan di "Memuat..." | Internet memblokir `cdn.jsdelivr.net` atau `gstatic.com` |
| iPhone tidak otomatis fullscreen/landscape | Putar HP manual; Safari membatasi fitur ini. Bisa "Add to Home Screen" |

## 10. Batasan yang perlu diketahui

- **Anti-cheat belum penuh.** Coin, Iron, Spin, dan EXP dihitung di server, tetapi hasil match (kill, peringkat) dan posisi pemain dilaporkan browser. Server hanya membatasi nilai dan jeda antar kiriman. Pemain yang paham teknis masih bisa curang.
- **Multiplayer** memakai Realtime Database antar-browser, cocok untuk main bersama teman. Tab yang diminimize membuat pemainnya berhenti; bila itu host, bot ikut berhenti.
- **Akun guest** terikat pada browser. Menghapus data situs berarti akun baru.
- **Progres offline** tersimpan terpisah dan tidak digabung ke akun online.
- Kuota gratis Firebase terbatas. Pantau di console bila pemain banyak.
- Data ruang pertandingan lama bisa tersisa di Realtime Database; node `rooms` dan `queue` aman dihapus berkala saat tidak ada yang bermain.
