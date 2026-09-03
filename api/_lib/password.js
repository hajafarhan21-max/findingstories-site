import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Password must contain 12 to 256 characters.');
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encoded) {
  const [algorithm, n, r, p, saltValue, hashValue] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  const expected = Buffer.from(hashValue, 'base64url');
  if (expected.length !== KEY_LENGTH) return false;
  const actual = await scrypt(String(password || ''), Buffer.from(saltValue, 'base64url'), KEY_LENGTH, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(expected, Buffer.from(actual));
}
