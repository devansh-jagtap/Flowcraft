import { describe, expect, it } from 'vitest';
import { api, signUp } from './helpers.js';

describe('auth', () => {
  it('registers without ever exposing the password hash', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Devansh', email: 'Dev@Example.com', password: 'password123' })
      .expect(201);

    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({
      id: expect.any(String),
      name: 'Devansh',
      email: 'dev@example.com',
      createdAt: expect.any(String),
    });
  });

  it('returns field-level validation errors', async () => {
    const res = await api().post('/api/auth/register').send({ name: 'D', email: 'nope', password: '123' }).expect(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual(['name', 'email', 'password']);
  });

  it('rejects a duplicate email', async () => {
    await signUp({ email: 'taken@example.com' });
    await api()
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'taken@example.com', password: 'password123' })
      .expect(409);
  });

  it('logs in only with the right password', async () => {
    await signUp({ email: 'me@example.com' });
    await api().post('/api/auth/login').send({ email: 'me@example.com', password: 'wrong-password' }).expect(401);
    const res = await api().post('/api/auth/login').send({ email: 'me@example.com', password: 'password123' }).expect(200);
    expect(res.body.user.email).toBe('me@example.com');
  });

  it('protects /me and rejects tampered tokens', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set({ Authorization: 'Bearer not.a.token' }).expect(401);

    const { auth } = await signUp();
    const res = await api().get('/api/auth/me').set(auth).expect(200);
    expect(res.body.user.name).toBe('Test User');
  });
});
