import type { DiagramRow, User } from './schema.js';

/** The API's diagram shape. `_id` and `owner` keep the field names the client has always used. Lists leave out positions. */
export function diagramJson({ id, ownerId, shareId, forkedFrom, ...rest }: Omit<DiagramRow, 'positions'> & Partial<Pick<DiagramRow, 'positions'>>) {
  return {
    _id: id,
    owner: ownerId,
    ...rest,
    ...(shareId && { shareId }),
    ...(forkedFrom && { forkedFrom }),
  };
}

export function userJson(user: User) {
  return { id: user.id, name: user.name, email: user.email ?? undefined, createdAt: user.createdAt };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
