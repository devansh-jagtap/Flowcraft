import { describe, expect, it } from 'vitest';
import { api, createDiagram, signUp } from './helpers.js';

describe('diagrams', () => {
  it('requires authentication', async () => {
    await api().get('/api/diagrams').expect(401);
  });

  it('creates a diagram with sensible defaults', async () => {
    const { auth } = await signUp();
    const res = await api().post('/api/diagrams').set(auth).send({ type: 'mindmap' }).expect(201);
    expect(res.body.diagram).toMatchObject({
      title: 'Untitled diagram',
      type: 'mindmap',
      theme: 'ocean',
      direction: 'TB',
      isPublic: false,
      positions: {},
    });
  });

  it('accepts initial node positions (e.g. when saving a playground draft)', async () => {
    const { auth } = await signUp();
    const res = await api()
      .post('/api/diagrams')
      .set(auth)
      .send({ type: 'flowchart', source: 'A -> B', positions: { a: { x: 1, y: 2 } } })
      .expect(201);
    expect(res.body.diagram.positions).toEqual({ a: { x: 1, y: 2 } });
  });

  it('rejects unknown diagram types', async () => {
    const { auth } = await signUp();
    await api().post('/api/diagrams').set(auth).send({ type: 'piechart' }).expect(400);
  });

  it('updates text, theme and dragged node positions', async () => {
    const { auth } = await signUp();
    const diagram = await createDiagram(auth);

    const res = await api()
      .patch(`/api/diagrams/${diagram._id}`)
      .set(auth)
      .send({ source: 'A -> B -> C', theme: 'forest', positions: { a: { x: 10, y: 20 } } })
      .expect(200);

    expect(res.body.diagram).toMatchObject({ source: 'A -> B -> C', theme: 'forest', positions: { a: { x: 10, y: 20 } } });
  });

  it('rejects empty updates and invalid positions', async () => {
    const { auth } = await signUp();
    const diagram = await createDiagram(auth);
    await api().patch(`/api/diagrams/${diagram._id}`).set(auth).send({}).expect(400);
    await api()
      .patch(`/api/diagrams/${diagram._id}`)
      .set(auth)
      .send({ positions: { a: { x: 'left', y: 1 } } })
      .expect(400);
  });

  it("hides other people's diagrams behind a 404", async () => {
    const alice = await signUp();
    const bob = await signUp();
    const diagram = await createDiagram(alice.auth);

    await api().get(`/api/diagrams/${diagram._id}`).set(bob.auth).expect(404);
    await api().patch(`/api/diagrams/${diagram._id}`).set(bob.auth).send({ title: 'Mine now' }).expect(404);
    await api().delete(`/api/diagrams/${diagram._id}`).set(bob.auth).expect(404);
    await api().get('/api/diagrams/not-an-id').set(bob.auth).expect(404);
  });

  it('lists, filters, searches and sorts with starred first', async () => {
    const { auth } = await signUp();
    await createDiagram(auth, { title: 'Checkout flow' });
    const tree = await createDiagram(auth, { title: 'Family tree', type: 'orgchart' });
    await createDiagram(auth, { title: 'Ideas (v2)', type: 'mindmap' });
    await api().patch(`/api/diagrams/${tree._id}`).set(auth).send({ starred: true }).expect(200);

    const all = await api().get('/api/diagrams').set(auth).expect(200);
    expect(all.body.diagrams[0].title).toBe('Family tree');
    expect(all.body.diagrams[0].positions).toBeUndefined();

    const mindmaps = await api().get('/api/diagrams?type=mindmap').set(auth).expect(200);
    expect(mindmaps.body.diagrams.map((d: { title: string }) => d.title)).toEqual(['Ideas (v2)']);

    // Special regex characters are treated literally.
    const search = await api().get(`/api/diagrams?q=${encodeURIComponent('(v2')}`).set(auth).expect(200);
    expect(search.body.diagrams).toHaveLength(1);

    const byTitle = await api().get('/api/diagrams?sort=title').set(auth).expect(200);
    expect(byTitle.body.diagrams.map((d: { title: string }) => d.title)).toEqual([
      'Checkout flow',
      'Family tree',
      'Ideas (v2)',
    ]);
  });

  it('summarises stats per user', async () => {
    const alice = await signUp();
    const bob = await signUp();
    await createDiagram(alice.auth);
    await createDiagram(alice.auth, { type: 'mindmap' });
    await createDiagram(bob.auth);

    const res = await api().get('/api/diagrams/stats').set(alice.auth).expect(200);
    expect(res.body).toEqual({
      byType: { flowchart: 1, mindmap: 1, orgchart: 0, er: 0, class: 0, usecase: 0, sequence: 0, state: 0 },
      diagrams: 2,
      shared: 0,
      views: 0,
    });
  });

  it('duplicates and deletes', async () => {
    const { auth } = await signUp();
    const diagram = await createDiagram(auth, { title: 'Original' });

    const copy = await api().post(`/api/diagrams/${diagram._id}/duplicate`).set(auth).expect(201);
    expect(copy.body.diagram).toMatchObject({ title: 'Original (copy)', source: 'A -> B', isPublic: false });

    await api().delete(`/api/diagrams/${diagram._id}`).set(auth).expect(204);
    await api().get(`/api/diagrams/${diagram._id}`).set(auth).expect(404);
  });
});

describe('prompt history', () => {
  it('stores the AI prompts on a diagram and copies them on duplicate', async () => {
    const { auth } = await signUp();
    const res = await api()
      .post('/api/diagrams')
      .set(auth)
      .send({ type: 'flowchart', source: 'A -> B', prompts: [{ text: 'make a flow', createdAt: '2026-01-01T00:00:00.000Z' }] })
      .expect(201);
    expect(res.body.diagram.prompts).toEqual([{ text: 'make a flow', createdAt: '2026-01-01T00:00:00.000Z' }]);

    const copy = await api().post(`/api/diagrams/${res.body.diagram._id}/duplicate`).set(auth).expect(201);
    expect(copy.body.diagram.prompts).toHaveLength(1);
  });
});
