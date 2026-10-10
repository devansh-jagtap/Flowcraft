import { describe, expect, it } from 'vitest';
import { User } from '../src/models/index.js';
import { fakeClerkUsers, tokenFor } from './fakeClerk.js';
import { api, signUp } from './helpers.js';

describe('auth', () => {
  it('rejects missing and invalid Clerk tokens', async () => {
    await api().get('/api/auth/me').expect(401);
    await api().get('/api/auth/me').set({ Authorization: 'Bearer not.a.token' }).expect(401);
  });

  it('creates a local user from the Clerk profile on first sign-in', async () => {
    const { user, auth } = await signUp({ name: 'Devansh Jagtap', email: 'Dev@Example.com' });
    expect(user).toEqual({ id: expect.any(String), name: 'Devansh Jagtap', email: 'dev@example.com', createdAt: expect.any(String) });

    const again = await api().get('/api/auth/me').set(auth).expect(200);
    expect(again.body.user.id).toBe(user.id);
    expect(await User.countDocuments()).toBe(1);
  });

  it('falls back to the username when Clerk has no name', async () => {
    const { user } = await signUp({ name: '', firstName: null, username: 'devj' });
    expect(user.name).toBe('devj');
  });

  it('lets the verified owner of an email claim an unclaimed account', async () => {
    const legacy = await User.create({ name: 'Old Account', email: 'me@example.com' });
    const { user } = await signUp({ email: 'me@example.com' });
    expect(user.id).toBe(legacy.id);
  });

  it('does not hand an account to an unverified email', async () => {
    const legacy = await User.create({ name: 'Old Account', email: 'me@example.com' });
    const { user } = await signUp({ email: 'me@example.com', emailVerified: false });
    expect(user.id).not.toBe(legacy.id);
    expect(user.email).toBeUndefined();
  });

  it('rejects a token once the Clerk user is gone', async () => {
    const { clerkId } = await signUp();
    fakeClerkUsers.delete(clerkId);
    await api().get('/api/auth/me').set({ Authorization: `Bearer ${tokenFor(clerkId)}` }).expect(401);
  });
});
