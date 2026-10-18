import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from './HttpError.js';

/**
 * Encrypts secrets (users' AI API keys) before they reach the database, with AES-256-GCM and a key
 * derived from AI_KEYS_SECRET. A database leak alone does not reveal the keys.
 * Stored format: "v1.<iv>.<auth tag>.<ciphertext>", each part base64url.
 */
const VERSION = 'v1';

function key(): Buffer {
  if (env.aiKeysSecret.length < 32) {
    throw new HttpError(
      503,
      "Saving API keys to accounts isn't set up on this server. Set AI_KEYS_SECRET (32+ random characters) and restart.",
      undefined,
      'AI_KEYS_UNAVAILABLE'
    );
  }
  return Buffer.from(hkdfSync('sha256', env.aiKeysSecret, 'flowcraft', 'user-ai-keys', 32));
}

export const canStoreSecrets = () => env.aiKeysSecret.length >= 32;

export function seal(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

export function open(sealed: string): string {
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Unreadable sealed secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

/** "sk-p…a1b2": enough to recognise a key without revealing it. */
export const keyHint = (apiKey: string) => `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`;
