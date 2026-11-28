# Blocky Royale update lanjutan

## Implementasi pada versi ini
- Bundle yang dimiliki sekarang bisa dipisahkan menjadi lima item kosmetik: Head/Hat, Accessories, Clothes, Pants, dan Shoes. Hasil pemisahan masuk ke kategori outfit Vault dan bisa dipakai terpisah.
- Events diperluas menjadi Event Harian, Mingguan, Bulanan, Master Challenge, dan Event Ramadhan. Ada progress login, kill, match loss/death, pemakaian bundle, serta klaim hadiah. Progress login bulanan dan kill mingguan memakai periode kalender WIB.
- Training sekarang memakai arena tersendiri, ruang persiapan, meja crate perlengkapan, portal ke firing range, dan tombol untuk kembali. Pemain lain/bot disembunyikan ketika berada di ruang persiapan; target latihan muncul di firing range.
- Social Island memakai generator map berbeda dengan pantai, pulau, area plaza, dan area aktivitas santai. Tidak memakai map battle royale.
- Pemilihan map battle tidak ditampilkan pada Training dan Social Island.
- Daftar teman memiliki penghapusan teman dan panel persiapan party, selain penambahan username.

## Masih memerlukan sistem multiplayer lanjutan
- Party lintas perangkat maksimal 4 pemain, undangan online, persetujuan anggota, leader yang memulai matchmaking, serta sinkronisasi squad belum aktif. UI daftar teman tidak boleh dianggap sebagai sistem undangan online.
- Nomor anggota squad dan spectator otomatis ke rekan yang masih hidup belum aktif karena matchmaking dan state pemain belum memiliki identitas squad.
- Revive Master ditampilkan sebagai tantangan, tetapi progress revive belum bertambah karena mekanik revive/squad belum tersedia.
- Social Island sudah memiliki map khusus, tetapi minigame dengan aturan, skor, dan reward sendiri belum dibuat.
- Event Ramadhan saat ini merupakan kategori event dan progress login, belum memiliki penjadwalan tanggal Ramadan otomatis atau konfigurasi hadiah admin.

## Tes
Jalankan `npm test`. Pengujian ekonomi mencakup split bundle dan event progress. Tes browser/WebGL dan multiplayer tetap perlu dilakukan di dua perangkat dengan Firebase aktif.

## Konfigurasi
Gunakan `.env.example` untuk konfigurasi. Jangan membagikan `.env` atau service account Firebase.


## Multiplayer party update
- Added online player presence indexed by normalized username in Realtime Database.
- Added cross-device party creation, online username invite, incoming invite accept/decline, max 4 members, leader controls, member removal, and leave party.
- Added leader match request with member approval/rejection. The match launches only after every current member approves.
- Added party matchmaking that waits for all party members in the same room and carries a shared squad ID into the game roster. Supports Battle Royale or Clash Royale and map selection.
- Added squad roster numbering and spectator camera handoff to a living squadmate after the local player is eliminated. Spectator mode does not restore movement or combat control.
- Updated `database.rules.json` with presence, party, invitation, party membership, and room launch paths. These rules must be published to Firebase Realtime Database Rules before online party features can work.

## Multiplayer deployment requirements
1. Firebase Authentication must have Anonymous sign-in enabled (or the existing custom-token login configured).
2. Realtime Database must be enabled and `databaseURL` configured in `/api/config`.
3. Import the updated `database.rules.json` into Firebase Realtime Database Rules and publish it.
4. Test with at least two separate authenticated devices/accounts. Local unit tests cannot verify Firebase permissions, network latency, or real-device synchronization.

## Remaining multiplayer scope
- Revive interaction and downed-state flow are not implemented in this patch.
- Social Island minigames with scoring/rewards are not implemented in this patch.
- Server-authoritative anti-cheat and hardened party write validation remain production-hardening work.
