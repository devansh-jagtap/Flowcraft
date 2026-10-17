import { clerkClient, verifyToken } from '@clerk/express';
import { and, eq, isNull } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { db } from '../db/client.js';
import { users, type User } from '../db/schema.js';

function bearerToken(req: Request): string | null {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/** Verifies a Clerk session token and returns the Clerk user id it belongs to. */
async function clerkIdFromToken(token: string): Promise<string | null> {
  try {
    const payload = await verifyToken(token, {
      secretKey: env.clerk.secretKey,
      jwtKey: env.clerk.jwtKey,
      authorizedParties: env.clientOrigins,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Builds the profile we keep locally (diagram ownership, author names on shared pages). */
async function clerkProfile(clerkId: string) {
  const clerkUser = await clerkClient.users.getUser(clerkId);
  const primary = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || clerkUser.username || primary?.emailAddress.split('@')[0] || 'Flowcraft user';
  return {
    name: name.slice(0, 60),
    email: primary?.emailAddress.toLowerCase(),
    emailVerified: primary?.verification?.status === 'verified',
  };
}

/** Finds the local user for a Clerk account, creating it on first sign-in. */
async function userForClerkId(clerkId: string): Promise<User> {
  const [existing] = await db().select().from(users).where(eq(users.clerkId, clerkId));
  if (existing) return existing;

  const { name, email, emailVerified } = await clerkProfile(clerkId);

  // Accounts created before Clerk (or by the seed script) are claimed by the verified owner of that email,
  // so their diagrams carry over.
  if (email && emailVerified) {
    const [claimed] = await db()
      .update(users)
      .set({ clerkId, updatedAt: new Date() })
      .where(and(eq(users.email, email), isNull(users.clerkId)))
      .returning();
    if (claimed) return claimed;
  }

  // Email is informational only (Clerk owns it), so leave it off rather than clash with an unclaimed account.
  const [taken] = email ? await db().select({ id: users.id }).from(users).where(eq(users.email, email)) : [];
  const [created] = await db()
    .insert(users)
    .values({ clerkId, name, ...(email && !taken ? { email } : {}) })
    .onConflictDoNothing({ target: users.clerkId })
    .returning();
  if (created) return created;

  // Two first requests raced; the other one created the row.
  const [raced] = await db().select().from(users).where(eq(users.clerkId, clerkId));
  return raced;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) throw HttpError.unauthorized();

  // Without a key every token fails to verify, which would otherwise look like an expired session.
  if (!env.isTest && !env.clerk.secretKey && !env.clerk.jwtKey) {
    throw new HttpError(503, "Sign-in isn't set up on the server. Add CLERK_SECRET_KEY to server/.env and restart the server.");
  }

  const clerkId = await clerkIdFromToken(token);
  if (!clerkId) throw HttpError.unauthorized('Your session has expired, please log in again');

  req.user = await userForClerkId(clerkId);
  next();
}

/** Like requireAuth, but lets guests through. A missing, invalid or expired token means "guest". */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  const canVerify = env.isTest || Boolean(env.clerk.secretKey || env.clerk.jwtKey);
  const clerkId = token && canVerify ? await clerkIdFromToken(token) : null;
  if (clerkId) req.user = await userForClerkId(clerkId);
  next();
}

/** Helper for handlers mounted behind requireAuth. */
export function currentUser(req: Request): User {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
