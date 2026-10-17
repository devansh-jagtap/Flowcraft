import { and, eq, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { diagrams, users } from '../db/schema.js';
import { diagramJson } from '../db/serialize.js';
import { HttpError } from '../lib/HttpError.js';
import { currentUser } from '../middleware/auth.js';

const isShared = (shareId: string) => and(eq(diagrams.shareId, shareId), eq(diagrams.isPublic, true));

export async function view(req: Request, res: Response) {
  // Counting a view doesn't change the diagram, so updated_at is left alone.
  const [diagram] = await db()
    .update(diagrams)
    .set({ views: sql`${diagrams.views} + 1` })
    .where(isShared(String(req.params.shareId)))
    .returning();
  if (!diagram) throw HttpError.notFound('This diagram is private or no longer exists');

  const [owner] = await db().select({ name: users.name }).from(users).where(eq(users.id, diagram.ownerId));
  const { _id, title, type, source, theme, direction, positions, prompts, views, updatedAt, shareId } = diagramJson(diagram);
  res.json({ diagram: { _id, title, type, source, theme, direction, positions, prompts, views, updatedAt, shareId, author: owner?.name ?? 'Unknown' } });
}

/** Copies a public diagram into the current user's workspace. */
export async function fork(req: Request, res: Response) {
  const [original] = await db().select().from(diagrams).where(isShared(String(req.params.shareId)));
  if (!original) throw HttpError.notFound('This diagram is private or no longer exists');

  const [copy] = await db()
    .insert(diagrams)
    .values({
      ownerId: currentUser(req).id,
      title: original.title,
      type: original.type,
      source: original.source,
      theme: original.theme,
      direction: original.direction,
      positions: original.positions,
      prompts: original.prompts,
      forkedFrom: original.id,
    })
    .returning();
  res.status(201).json({ diagram: diagramJson(copy) });
}
