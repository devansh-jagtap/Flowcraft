import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { and, eq, gt, lt, lte, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { aiUsage } from '../db/schema.js';

/** What the client shows as "3 of 5 free generations left". */
export interface FreeUsage {
  limit: number;
  remaining: number;
  /** When the window ends, or null if nothing has been used yet. */
  resetsAt: string | null;
}

const windowMs = () => env.freeAi.windowHours * 60 * 60 * 1000;

function toUsage(count: number, resetsAt: Date | null): FreeUsage {
  const { limit } = env.freeAi;
  return { limit, remaining: Math.max(0, limit - count), resetsAt: resetsAt?.toISOString() ?? null };
}

export async function freeUsage(key: string): Promise<FreeUsage> {
  const [usage] = await db().select().from(aiUsage).where(eq(aiUsage.key, key));
  return usage && usage.resetsAt > new Date() ? toUsage(usage.count, usage.resetsAt) : toUsage(0, null);
}

function limitReached(resetsAt: Date | null): HttpError {
  const { limit, windowHours } = env.freeAi;
  if (limit === 0) {
    return new HttpError(402, 'Add your own API key to generate diagrams with AI.', undefined, 'AI_KEY_REQUIRED');
  }
  const when = resetsAt ? ` They reset ${resetsAt.toUTCString().replace(/:\d\d GMT$/, ' UTC')}.` : '';
  const period = windowHours === 24 ? 'today' : `in the last ${windowHours} hours`;
  return new HttpError(
    429,
    `You've used your ${limit} free AI generation${limit === 1 ? '' : 's'} ${period}. Add your own API key to keep going.${when}`,
    undefined,
    'AI_FREE_LIMIT'
  );
}

/**
 * Atomically takes one free generation, or throws if the visitor has none left.
 * Call refundFreeGeneration if the generation then fails, so errors don't eat the quota.
 */
export async function reserveFreeGeneration(key: string): Promise<FreeUsage> {
  const { limit } = env.freeAi;
  if (limit === 0) throw limitReached(null);

  const now = new Date();
  const resetsAt = new Date(now.getTime() + windowMs());
  const ended = lte(aiUsage.resetsAt, now);
  // One atomic statement: start a fresh window if there is none or it has ended, otherwise count one more
  // unless the limit is reached (then no row comes back).
  const [usage] = await db()
    .insert(aiUsage)
    .values({ key, count: 1, resetsAt })
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
    const [current] = await db().select().from(aiUsage).where(eq(aiUsage.key, key));
    throw limitReached(current?.resetsAt ?? null);
  }
  // Now and then, clear out windows that ended over a day ago so guest IPs don't pile up.
  if (Math.random() < 0.02) await db().delete(aiUsage).where(lt(aiUsage.resetsAt, new Date(now.getTime() - 86_400_000)));
  return toUsage(usage.count, usage.resetsAt);
}

export async function refundFreeGeneration(key: string): Promise<void> {
  await db()
    .update(aiUsage)
    .set({ count: sql`${aiUsage.count} - 1` })
    .where(and(eq(aiUsage.key, key), gt(aiUsage.count, 0)));
}
