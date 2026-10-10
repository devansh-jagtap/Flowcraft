import { describe, expect, it } from 'vitest';
import { api, createDiagram, signUp } from './helpers.js';

async function sharedDiagram() {
  const owner = await signUp({ name: 'Owner Person' });
  const diagram = await createDiagram(owner.auth, { title: 'Public flow' });
  const res = await api().post(`/api/diagrams/${diagram._id}/share`).set(owner.auth).send({ isPublic: true }).expect(200);
  return { owner, diagram: res.body.diagram };
}

describe('sharing', () => {
  it('creates a share link and serves a read-only copy with view counting', async () => {
    const { diagram } = await sharedDiagram();
    expect(diagram.shareId).toMatch(/^[a-zA-Z0-9]{10}$/);

    await api().get(`/api/shared/${diagram.shareId}`).expect(200);
    const res = await api().get(`/api/shared/${diagram.shareId}`).expect(200);

    expect(res.body.diagram).toMatchObject({ title: 'Public flow', author: 'Owner Person', views: 2 });
    expect(res.body.diagram.isPublic).toBeUndefined();
  });

  it('keeps the same link when sharing is turned off and on again', async () => {
    const { owner, diagram } = await sharedDiagram();
    const url = `/api/diagrams/${diagram._id}/share`;

    await api().post(url).set(owner.auth).send({ isPublic: false }).expect(200);
    await api().get(`/api/shared/${diagram.shareId}`).expect(404);

    const again = await api().post(url).set(owner.auth).send({ isPublic: true }).expect(200);
    expect(again.body.diagram.shareId).toBe(diagram.shareId);
  });

  it('lets another user fork a public diagram', async () => {
    const { diagram } = await sharedDiagram();
    const visitor = await signUp();

    await api().post(`/api/shared/${diagram.shareId}/fork`).expect(401);
    const res = await api().post(`/api/shared/${diagram.shareId}/fork`).set(visitor.auth).expect(201);
    expect(res.body.diagram).toMatchObject({ title: 'Public flow', isPublic: false, forkedFrom: diagram._id });

    const mine = await api().get('/api/diagrams').set(visitor.auth).expect(200);
    expect(mine.body.diagrams).toHaveLength(1);
  });

  it('returns 404 for unknown share ids', async () => {
    await api().get('/api/shared/doesnotexist').expect(404);
  });
});
