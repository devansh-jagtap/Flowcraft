import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { userAiKeys, users } from '../db/schema.js';
import { HttpError } from '../lib/HttpError.js';
import { keyHint, open, seal } from '../lib/secretBox.js';
import { ownCredentials, PROVIDER_LABELS, type AiCredentials, type AiProvider } from './llm.js';

/** What the client may see about a saved key: never the key itself. */
export interface SavedKeyInfo {
  provider: AiProvider;
  hint: string;
  model: string | null;
  verifiedAt: Date | null;
  updatedAt: Date;
}

export async function listKeys(userId: string): Promise<{ keys: SavedKeyInfo[]; active: AiProvider | null }> {
  const [rows, [user]] = await Promise.all([
    db()
      .select({
        provider: userAiKeys.provider,
        hint: userAiKeys.keyHint,
        model: userAiKeys.model,
        verifiedAt: userAiKeys.verifiedAt,
        updatedAt: userAiKeys.updatedAt,
      })
      .from(userAiKeys)
      .where(eq(userAiKeys.userId, userId)),
    db().select({ aiProvider: users.aiProvider }).from(users).where(eq(users.id, userId)),
  ]);
  return { keys: rows, active: user?.aiProvider ?? null };
}

async function storedKey(userId: string, provider: AiProvider) {
  const [row] = await db()
    .select()
    .from(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)));
  return row;
}

/** Credentials for a saved key, decrypted only for the request that uses it. */
export async function savedCredentials(userId: string, provider: AiProvider, model?: string | null): Promise<AiCredentials> {
  const row = await storedKey(userId, provider);
  if (!row) throw HttpError.notFound(`No ${PROVIDER_LABELS[provider]} key is saved to your account`);
  return ownCredentials(provider, open(row.encryptedKey), model === undefined ? (row.model ?? undefined) : (model ?? undefined));
}

/** The key the account has chosen for generating, or null to use the free generations. */
export async function activeCredentials(userId: string, active: AiProvider | null | undefined): Promise<AiCredentials | null> {
  if (!active) return null;
  const row = await storedKey(userId, active);
  // The chosen key was removed elsewhere: fall back to the free generations.
  if (!row) return null;
  return ownCredentials(active, open(row.encryptedKey), row.model ?? undefined);
}

/**
 * Saves or updates a provider's key. Without a new apiKey only the model changes. The first key an
 * account saves becomes the one it generates with.
 */
export async function saveKey(
  userId: string,
  provider: AiProvider,
  update: { apiKey?: string; model?: string | null; verified: boolean }
): Promise<void> {
  const existing = await storedKey(userId, provider);
  if (!existing && !update.apiKey) throw HttpError.badRequest('Enter the API key');
  const now = new Date();
  const values = {
    ...(update.apiKey && { encryptedKey: seal(update.apiKey), keyHint: keyHint(update.apiKey) }),
    ...(update.model !== undefined && { model: update.model || null }),
    // A new key or model hasn't been checked unless this save tested it.
    verifiedAt: update.verified ? now : update.apiKey || update.model !== undefined ? null : (existing?.verifiedAt ?? null),
    updatedAt: now,
  };

  if (existing) {
    await db()
      .update(userAiKeys)
      .set(values)
      .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)));
  } else {
    await db()
      .insert(userAiKeys)
      .values({ userId, provider, encryptedKey: values.encryptedKey!, keyHint: values.keyHint!, model: values.model ?? null, verifiedAt: values.verifiedAt });
    const [user] = await db().select({ aiProvider: users.aiProvider }).from(users).where(eq(users.id, userId));
    if (!user?.aiProvider) await setActive(userId, provider);
  }
}

export async function markVerified(userId: string, provider: AiProvider) {
  await db()
    .update(userAiKeys)
    .set({ verifiedAt: new Date() })
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)));
}

export async function removeKey(userId: string, provider: AiProvider): Promise<void> {
  await db()
    .delete(userAiKeys)
    .where(and(eq(userAiKeys.userId, userId), eq(userAiKeys.provider, provider)));
  await db()
    .update(users)
    .set({ aiProvider: null })
    .where(and(eq(users.id, userId), eq(users.aiProvider, provider)));
}

/** Chooses which saved key generates diagrams; null switches back to the free generations. */
export async function setActive(userId: string, provider: AiProvider | null): Promise<void> {
  if (provider && !(await storedKey(userId, provider))) {
    throw HttpError.badRequest(`Save a ${PROVIDER_LABELS[provider]} key before choosing it`);
  }
  await db().update(users).set({ aiProvider: provider, updatedAt: new Date() }).where(eq(users.id, userId));
}
