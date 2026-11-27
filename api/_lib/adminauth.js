import { verifyPw } from './pw.js';

const strip = (v) => String(v ?? '').trim().replace(/^['"`]+|['"`]+$/g, '').trim();
export const keyOf = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, '_');
export const hashFormatOk = (h) => /^scrypt:[0-9a-f]{8,}:[0-9a-f]{128}$/i.test(h);

/** Cocokkan username/password dengan ADMIN_USERNAME dan ADMIN_PASSWORD_HASH (toleran spasi/tanda kutip di env). */
export function checkAdmin(username, password, env = process.env) {
  const adminName = strip(env.ADMIN_USERNAME);
  if (!adminName || keyOf(username) !== keyOf(adminName)) return { isAdmin: false };
  const hash = strip(env.ADMIN_PASSWORD_HASH);
  if (!hashFormatOk(hash)) return { isAdmin: true, ok: false, configError: 'ADMIN_PASSWORD_HASH salah format. Buat ulang dengan: node scripts/hash.mjs "password"' };
  return { isAdmin: true, ok: verifyPw(String(password ?? ''), hash) };
}
