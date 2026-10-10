import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();
export const api = () => request(app);

let counter = 0;

export async function signUp(overrides: Record<string, string> = {}) {
  counter += 1;
  const res = await api()
    .post('/api/auth/register')
    .send({ name: 'Test User', email: `user${counter}@example.com`, password: 'password123', ...overrides })
    .expect(201);
  return { user: res.body.user, auth: { Authorization: `Bearer ${res.body.token}` } };
}

export async function createDiagram(auth: Record<string, string>, body: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/diagrams')
    .set(auth)
    .send({ type: 'flowchart', title: 'My flow', source: 'A -> B', ...body })
    .expect(201);
  return res.body.diagram;
}
