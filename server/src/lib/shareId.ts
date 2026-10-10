import { randomBytes } from 'node:crypto';

const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** URL-friendly random id without look-alike characters (0/O, 1/l/I). */
export function createShareId(length = 10): string {
  const bytes = randomBytes(length);
  let id = '';
  for (const byte of bytes) id += ALPHABET[byte % ALPHABET.length];
  return id;
}
