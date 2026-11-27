// Buat hash password admin:  node scripts/hash.mjs "PasswordKuat123"
// Hasilnya ditempel ke env ADMIN_PASSWORD_HASH (bersama ADMIN_USERNAME).
import { hashPw } from '../api/_lib/pw.js';
if (!process.argv[2]) { console.log('Pakai: node scripts/hash.mjs "password"'); process.exit(1); }
console.log(hashPw(process.argv[2]));
