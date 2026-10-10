import { describe, expect, it } from 'vitest';
import { api } from './helpers.js';

describe('app', () => {
  it('reports health', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('returns JSON 404s for unknown API routes', async () => {
    const res = await api().get('/api/nope').expect(404);
    expect(res.body.error.message).toMatch(/not found/);
  });

  it('handles malformed JSON', async () => {
    await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad').expect(400);
  });
});
