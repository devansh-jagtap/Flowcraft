import { and, asc, count, desc, eq, getTableColumns, ilike, sql, type SQL } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { db } from '../db/client.js';
import { diagrams, lowerTitle } from '../db/schema.js';
import { diagramJson, isUuid } from '../db/serialize.js';
import { HttpError } from '../lib/HttpError.js';
import { createShareId } from '../lib/shareId.js';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { DIAGRAM_TYPES } from '../models/index.js';
import {
  createDiagramSchema,
  listDiagramsSchema,
  shareSchema,
  updateDiagramSchema,
} from '../validators/diagram.schemas.js';

const SORTS: Record<string, SQL[]> = {
  updated: [desc(diagrams.starred), desc(diagrams.updatedAt)],
  created: [desc(diagrams.createdAt)],
  title: [asc(lowerTitle)],
};

/** Escapes LIKE wildcards so a search for "50%" means the literal text. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/** Loads a diagram owned by the current user, or 404s (never 403, so ids can't be probed). */
async function findOwned(req: Request) {
  const { id } = req.params;
  if (!isUuid(id)) throw HttpError.notFound('Diagram not found');

  const [diagram] = await db()
    .select()
    .from(diagrams)
    .where(and(eq(diagrams.id, id), eq(diagrams.ownerId, currentUser(req).id)));
  if (!diagram) throw HttpError.notFound('Diagram not found');
  return diagram;
}

export async function list(req: Request, res: Response) {
  const { q, type, starred, sort } = parse(listDiagramsSchema, req.query);
  const filters: SQL[] = [eq(diagrams.ownerId, currentUser(req).id)];

  if (type !== 'all') filters.push(eq(diagrams.type, type));
  if (starred) filters.push(eq(diagrams.starred, starred === 'true'));
  if (q) filters.push(ilike(diagrams.title, `%${escapeLike(q)}%`));

  // The library doesn't need dragged node positions, which can be large.
  const { positions: _positions, ...columns } = getTableColumns(diagrams);
  const rows = await db()
    .select(columns)
    .from(diagrams)
    .where(and(...filters))
    .orderBy(...SORTS[sort]);
  res.json({ diagrams: rows.map(diagramJson) });
}

/** Dashboard summary computed in one query. */
export async function stats(req: Request, res: Response) {
  const rows = await db()
    .select({
      type: diagrams.type,
      diagrams: count(),
      shared: sql<number>`count(*) filter (where ${diagrams.isPublic})`.mapWith(Number),
      views: sql<number>`coalesce(sum(${diagrams.views}), 0)`.mapWith(Number),
    })
    .from(diagrams)
    .where(eq(diagrams.ownerId, currentUser(req).id))
    .groupBy(diagrams.type);

  const byType = Object.fromEntries(DIAGRAM_TYPES.map((t) => [t, 0]));
  const totals = { diagrams: 0, shared: 0, views: 0 };
  for (const row of rows) {
    byType[row.type] = row.diagrams;
    totals.diagrams += row.diagrams;
    totals.shared += row.shared;
    totals.views += row.views;
  }

  res.json({ byType, ...totals });
}

export async function create(req: Request, res: Response) {
  const input = parse(createDiagramSchema, req.body);
  const [diagram] = await db()
    .insert(diagrams)
    .values({ ...input, prompts: input.prompts?.map(promptJson), ownerId: currentUser(req).id })
    .returning();
  res.status(201).json({ diagram: diagramJson(diagram) });
}

export async function getOne(req: Request, res: Response) {
  res.json({ diagram: diagramJson(await findOwned(req)) });
}

export async function update(req: Request, res: Response) {
  const existing = await findOwned(req);
  const { prompts, ...rest } = parse(updateDiagramSchema, req.body);

  const [diagram] = await db()
    .update(diagrams)
    .set({ ...rest, ...(prompts && { prompts: prompts.map(promptJson) }), updatedAt: new Date() })
    .where(eq(diagrams.id, existing.id))
    .returning();
  res.json({ diagram: diagramJson(diagram) });
}

export async function remove(req: Request, res: Response) {
  const diagram = await findOwned(req);
  await db().delete(diagrams).where(eq(diagrams.id, diagram.id));
  res.status(204).end();
}

export async function duplicate(req: Request, res: Response) {
  const original = await findOwned(req);
  const [copy] = await db()
    .insert(diagrams)
    .values({
      ownerId: original.ownerId,
      title: `${original.title} (copy)`.slice(0, 100),
      type: original.type,
      source: original.source,
      theme: original.theme,
      direction: original.direction,
      positions: original.positions,
      prompts: original.prompts,
    })
    .returning();
  res.status(201).json({ diagram: diagramJson(copy) });
}

export async function share(req: Request, res: Response) {
  const existing = await findOwned(req);
  const { isPublic } = parse(shareSchema, req.body);

  const [diagram] = await db()
    .update(diagrams)
    .set({
      isPublic,
      // Keep the same id when re-sharing so previously sent links keep working.
      ...(isPublic && !existing.shareId && { shareId: createShareId() }),
      updatedAt: new Date(),
    })
    .where(eq(diagrams.id, existing.id))
    .returning();
  res.json({ diagram: diagramJson(diagram) });
}

/** Prompts are stored as JSON, so dates are kept as ISO strings. */
const promptJson = (p: { text: string; createdAt: Date }) => ({ text: p.text, createdAt: p.createdAt.toISOString() });
