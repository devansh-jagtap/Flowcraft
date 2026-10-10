import request from 'supertest';
import { createApp } from '../src/app.js';
import { fakeClerkUsers, tokenFor, type FakeClerkUser } from './fakeClerk.js';

const app = createApp();
export const api = () => request(app);

let counter = 0;

/** Signs in as a fresh Clerk user; the API creates the local user on the first request. */
export async function signUp({ name = 'Test User', ...overrides }: { name?: string } & Partial<FakeClerkUser> = {}) {
  counter += 1;
  const clerkId = `user_${counter}`;
  const [firstName, ...rest] = name.split(' ');
  fakeClerkUsers.set(clerkId, { firstName, lastName: rest.join(' ') || null, username: null, email: `user${counter}@example.com`, ...overrides });

  const auth = { Authorization: `Bearer ${tokenFor(clerkId)}` };
  const res = await api().get('/api/auth/me').set(auth).expect(200);
  return { user: res.body.user, auth, clerkId };
}

export async function createDiagram(auth: Record<string, string>, body: Record<string, unknown> = {}) {
  const res = await api()
    .post('/api/diagrams')
    .set(auth)
    .send({ type: 'flowchart', title: 'My flow', source: 'A -> B', ...body })
    .expect(201);
  return res.body.diagram;
}
