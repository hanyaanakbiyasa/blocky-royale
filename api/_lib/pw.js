import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
/** Format hash: scrypt:<salt hex>:<hash hex> */
export const hashPw = (pw, salt = randomBytes(16).toString('hex')) => `scrypt:${salt}:${scryptSync(String(pw), salt, 64).toString('hex')}`;
export function verifyPw(pw, stored) {
  const [alg, salt, hex] = String(stored || '').split(':');
  if (alg !== 'scrypt' || !salt || !hex) return false;
  const a = scryptSync(String(pw), salt, 64), b = Buffer.from(hex, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
