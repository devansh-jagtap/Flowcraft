import { and, count, desc, eq, gte, lt, max, sql, sum } from 'drizzle-orm';
import { db } from '../db/client.js';
import { aiEvents } from '../db/schema.js';
import type { AiCredentials, TokenUsage } from './llm.js';

const DAY_MS = 86_400_000;
/** The dashboard looks back this far; older events are cleared out now and then. */
export const USAGE_WINDOW_DAYS = 30;
const KEEP_DAYS = 90;

export interface UsageEventInput {
  subject: string;
  credentials: AiCredentials;
  ok: boolean;
  errorCode?: string;
  calls: number;
  tokens: TokenUsage;
  durationMs: number;
  prompt?: string;
}

/** Records one generation. Failures here never break the user's request. */
export async function recordUsage(event: UsageEventInput): Promise<void> {
  try {
    await db()
      .insert(aiEvents)
      .values({
        subject: event.subject,
        source: event.credentials.own ? 'own' : 'free',
        provider: event.credentials.provider,
        model: event.credentials.model,
        ok: event.ok,
        errorCode: event.errorCode ?? null,
        calls: event.calls,
        inputTokens: event.tokens.inputTokens,
        outputTokens: event.tokens.outputTokens,
        durationMs: Math.round(event.durationMs),
        prompt: event.prompt?.slice(0, 120) ?? null,
      });
    if (Math.random() < 0.02) await db().delete(aiEvents).where(lt(aiEvents.createdAt, new Date(Date.now() - KEEP_DAYS * DAY_MS)));
  } catch (err) {
    console.error('Could not record AI usage:', (err as Error).message);
  }
}

/** Totals by source, provider and model, a per-day series and the latest events for one visitor. */
export async function usageSummary(subject: string) {
  const since = new Date(Date.now() - USAGE_WINDOW_DAYS * DAY_MS);
  const mine = and(eq(aiEvents.subject, subject), gte(aiEvents.createdAt, since));

  const [byModel, daily, recent] = await Promise.all([
    db()
      .select({
        source: aiEvents.source,
        provider: aiEvents.provider,
        model: aiEvents.model,
        generations: count(),
        failed: sql<number>`count(*) filter (where not ${aiEvents.ok})`.mapWith(Number),
        inputTokens: sum(aiEvents.inputTokens).mapWith(Number),
        outputTokens: sum(aiEvents.outputTokens).mapWith(Number),
        lastUsedAt: max(aiEvents.createdAt),
      })
      .from(aiEvents)
      .where(mine)
      .groupBy(aiEvents.source, aiEvents.provider, aiEvents.model)
      .orderBy(desc(max(aiEvents.createdAt))),
    db()
      .select({
        day: sql<string>`to_char(date_trunc('day', ${aiEvents.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        generations: count(),
        tokens: sql<number>`coalesce(sum(${aiEvents.inputTokens} + ${aiEvents.outputTokens}), 0)`.mapWith(Number),
      })
      .from(aiEvents)
      .where(mine)
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db()
      .select({
        id: aiEvents.id,
        source: aiEvents.source,
        provider: aiEvents.provider,
        model: aiEvents.model,
        ok: aiEvents.ok,
        errorCode: aiEvents.errorCode,
        inputTokens: aiEvents.inputTokens,
        outputTokens: aiEvents.outputTokens,
        durationMs: aiEvents.durationMs,
        prompt: aiEvents.prompt,
        createdAt: aiEvents.createdAt,
      })
      .from(aiEvents)
      .where(eq(aiEvents.subject, subject))
      .orderBy(desc(aiEvents.createdAt))
      .limit(20),
  ]);

  return { windowDays: USAGE_WINDOW_DAYS, byModel, daily, recent };
}
