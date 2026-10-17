import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { AiUsage } from '../models/AiUsage.js';

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
  const usage = await AiUsage.findOne({ key }).lean();
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
  // Start a fresh window when there is no record yet or the last window has ended.
  await AiUsage.updateOne({ key }, { $setOnInsert: { count: 0, resetsAt } }, { upsert: true });
  await AiUsage.updateOne({ key, resetsAt: { $lte: now } }, { $set: { count: 0, resetsAt } });

  const usage = await AiUsage.findOneAndUpdate({ key, count: { $lt: limit } }, { $inc: { count: 1 } }, { new: true }).lean();
  if (!usage) {
    const current = await AiUsage.findOne({ key }).lean();
    throw limitReached(current?.resetsAt ?? null);
  }
  return toUsage(usage.count, usage.resetsAt);
}

export async function refundFreeGeneration(key: string): Promise<void> {
  await AiUsage.updateOne({ key, count: { $gt: 0 } }, { $inc: { count: -1 } });
}
