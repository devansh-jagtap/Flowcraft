import type { Request, Response } from 'express';
import { HttpError } from '../lib/HttpError.js';
import { currentUser } from '../middleware/auth.js';
import { Diagram } from '../models/index.js';

const PUBLIC_FIELDS = 'title type source theme direction positions views updatedAt owner shareId';

export async function view(req: Request, res: Response) {
  const diagram = await Diagram.findOneAndUpdate(
    { shareId: req.params.shareId, isPublic: true },
    { $inc: { views: 1 } },
    { new: true, timestamps: false }
  )
    .select(PUBLIC_FIELDS)
    .populate<{ owner: { name: string } }>('owner', 'name');

  if (!diagram) throw HttpError.notFound('This diagram is private or no longer exists');

  const { owner, ...rest } = diagram.toObject();
  res.json({ diagram: { ...rest, author: owner?.name ?? 'Unknown' } });
}

/** Copies a public diagram into the current user's workspace. */
export async function fork(req: Request, res: Response) {
  const original = await Diagram.findOne({ shareId: req.params.shareId, isPublic: true });
  if (!original) throw HttpError.notFound('This diagram is private or no longer exists');

  const copy = await Diagram.create({
    owner: currentUser(req)._id,
    title: original.title,
    type: original.type,
    source: original.source,
    theme: original.theme,
    direction: original.direction,
    positions: original.positions,
    forkedFrom: original._id,
  });
  res.status(201).json({ diagram: copy });
}
