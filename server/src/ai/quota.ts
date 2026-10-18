import { and, eq, gt, lt, lte, or, sql } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { aiUsage } from '../db/schema.js';
import { HttpError } from '../lib/HttpError.js';

/** What the client shows as "3 of 5 free generations left". */
export interface FreeUsage {
  limit: number;
  remaining: number;
  /** When the window ends, or null if nothing has been used yet. */
  resetsAt: string | null;
}

/** Who is asking: accounts are counted by user id, guests by network address with a smaller allowance. */
export interface QuotaSubject {
  key: string;
  guest: boolean;
}

export const freeLimit = (subject: QuotaSubject) => (subject.guest ? env.freeAi.guestLimit : env.freeAi.limit);

const windowMs = () => env.freeAi.windowHours * 60 * 60 * 1000;

function toUsage(limit: number, count: number, resetsAt: Date | null): FreeUsage {
  return { limit, remaining: Math.max(0, limit - count), resetsAt: resetsAt?.toISOString() ?? null };
}

export async function freeUsage(subject: QuotaSubject): Promise<FreeUsage> {
  const limit = freeLimit(subject);
  const [usage] = await db().select().from(aiUsage).where(eq(aiUsage.key, subject.key));
  return usage && usage.resetsAt > new Date() ? toUsage(limit, usage.count, usage.resetsAt) : toUsage(limit, 0, null);
}

function limitReached(subject: QuotaSubject, resetsAt: Date | null): HttpError {
  const limit = freeLimit(subject);
  const { windowHours } = env.freeAi;
  const accountLimit = env.freeAi.limit;
  const upgrade = subject.guest && accountLimit > limit;

  if (limit === 0) {
    return upgrade
      ? new HttpError(401, `Sign in to get ${accountLimit} free AI generations a day, or add your own API key.`, undefined, 'AI_SIGN_IN')
      : new HttpError(402, 'Add your own API key to generate diagrams with AI.', undefined, 'AI_KEY_REQUIRED');
  }
  const when = resetsAt ? ` They reset ${resetsAt.toUTCString().replace(/:\d\d GMT$/, ' UTC')}.` : '';
  const period = windowHours === 24 ? 'today' : `in the last ${windowHours} hours`;
  const next = upgrade ? `Sign in to get ${accountLimit} a day, or add your own API key.` : 'Add your own API key to keep going.';
  return new HttpError(
    429,
    `You've used your ${limit} free ${subject.guest ? 'guest ' : ''}AI generation${limit === 1 ? '' : 's'} ${period}. ${next}${when}`,
    undefined,
    'AI_FREE_LIMIT'
  );
}

/**
 * Atomically takes one free generation, or throws if the visitor has none left.
 * Call refundFreeGeneration if the generation then fails, so errors don't eat the quota.
 */
export async function reserveFreeGeneration(subject: QuotaSubject): Promise<FreeUsage> {
  const limit = freeLimit(subject);
  if (limit === 0) throw limitReached(subject, null);

  const now = new Date();
  const resetsAt = new Date(now.getTime() + windowMs());
  const ended = lte(aiUsage.resetsAt, now);
  // One atomic statement: start a fresh window if there is none or it has ended, otherwise count one more
  // unless the limit is reached (then no row comes back).
  const [usage] = await db()
    .insert(aiUsage)
    .values({ key: subject.key, count: 1, resetsAt })
    .onConflictDoUpdate({
      target: aiUsage.key,
      set: {
        count: sql`case when ${ended} then 1 else ${aiUsage.count} + 1 end`,
        resetsAt: sql`case when ${ended} then excluded.resets_at else ${aiUsage.resetsAt} end`,
      },
      setWhere: or(ended, lt(aiUsage.count, limit)),
    })
    .returning();

  if (!usage) {
    const [current] = await db().select().from(aiUsage).where(eq(aiUsage.key, subject.key));
    throw limitReached(subject, current?.resetsAt ?? null);
  }
  // Now and then, clear out windows that ended over a day ago so guest IPs don't pile up.
  if (Math.random() < 0.02) await db().delete(aiUsage).where(lt(aiUsage.resetsAt, new Date(now.getTime() - 86_400_000)));
  return toUsage(limit, usage.count, usage.resetsAt);
}

export async function refundFreeGeneration(subject: QuotaSubject): Promise<void> {
  await db()
    .update(aiUsage)
    .set({ count: sql`${aiUsage.count} - 1` })
    .where(and(eq(aiUsage.key, subject.key), gt(aiUsage.count, 0)));
}
