import type { Request, Response } from 'express';
import mongoose, { type FilterQuery, type SortOrder } from 'mongoose';
import { HttpError } from '../lib/HttpError.js';
import { createShareId } from '../lib/shareId.js';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { Diagram, DIAGRAM_TYPES, type IDiagram } from '../models/index.js';
import {
  createDiagramSchema,
  listDiagramsSchema,
  shareSchema,
  updateDiagramSchema,
} from '../validators/diagram.schemas.js';

const SORTS: Record<string, Record<string, SortOrder>> = {
  updated: { starred: -1, updatedAt: -1 },
  created: { createdAt: -1 },
  title: { title: 1 },
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Loads a diagram owned by the current user, or 404s (never 403, so ids can't be probed). */
async function findOwned(req: Request) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw HttpError.notFound('Diagram not found');

  const diagram = await Diagram.findOne({ _id: id, owner: currentUser(req)._id });
  if (!diagram) throw HttpError.notFound('Diagram not found');
  return diagram;
}

export async function list(req: Request, res: Response) {
  const { q, type, starred, sort } = parse(listDiagramsSchema, req.query);
  const filter: FilterQuery<IDiagram> = { owner: currentUser(req)._id };

  if (type !== 'all') filter.type = type;
  if (starred) filter.starred = starred === 'true';
  if (q) filter.title = { $regex: escapeRegex(q), $options: 'i' };

  const diagrams = await Diagram.find(filter)
    .sort(SORTS[sort])
    .select('-positions')
    .collation({ locale: 'en' })
    .lean();
  res.json({ diagrams });
}

/** Dashboard summary computed in one aggregation. */
export async function stats(req: Request, res: Response) {
  const [result] = await Diagram.aggregate<{
    byType: { _id: string; count: number }[];
    totals: { diagrams: number; shared: number; views: number }[];
  }>([
    { $match: { owner: currentUser(req)._id } },
    {
      $facet: {
        byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
        totals: [
          {
            $group: {
              _id: null,
              diagrams: { $sum: 1 },
              shared: { $sum: { $cond: ['$isPublic', 1, 0] } },
              views: { $sum: '$views' },
            },
          },
          { $project: { _id: 0 } },
        ],
      },
    },
  ]);

  const byType = Object.fromEntries(DIAGRAM_TYPES.map((t) => [t, 0]));
  for (const row of result.byType) byType[row._id] = row.count;

  res.json({ byType, ...(result.totals[0] ?? { diagrams: 0, shared: 0, views: 0 }) });
}

export async function create(req: Request, res: Response) {
  const input = parse(createDiagramSchema, req.body);
  const diagram = await Diagram.create({ ...input, owner: currentUser(req)._id });
  res.status(201).json({ diagram });
}

export async function getOne(req: Request, res: Response) {
  res.json({ diagram: await findOwned(req) });
}

export async function update(req: Request, res: Response) {
  const diagram = await findOwned(req);
  const { positions, ...rest } = parse(updateDiagramSchema, req.body);

  diagram.set(rest);
  if (positions) diagram.positions = new Map(Object.entries(positions));
  await diagram.save();

  res.json({ diagram });
}

export async function remove(req: Request, res: Response) {
  const diagram = await findOwned(req);
  await diagram.deleteOne();
  res.status(204).end();
}

export async function duplicate(req: Request, res: Response) {
  const original = await findOwned(req);
  const copy = await Diagram.create({
    owner: original.owner,
    title: `${original.title} (copy)`.slice(0, 100),
    type: original.type,
    source: original.source,
    theme: original.theme,
    direction: original.direction,
    positions: original.positions,
    prompts: original.prompts,
  });
  res.status(201).json({ diagram: copy });
}

export async function share(req: Request, res: Response) {
  const diagram = await findOwned(req);
  const { isPublic } = parse(shareSchema, req.body);

  diagram.isPublic = isPublic;
  // Keep the same id when re-sharing so previously sent links keep working.
  if (isPublic && !diagram.shareId) diagram.shareId = createShareId();
  await diagram.save();

  res.json({ diagram });
}
