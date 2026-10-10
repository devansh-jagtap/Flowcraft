/**
 * Stand-in for Clerk so tests never hit the network: a "session token" is `test:<clerkId>`,
 * and profiles come from the registry below.
 */
export interface FakeClerkUser {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  email?: string;
  emailVerified?: boolean;
}

export const fakeClerkUsers = new Map<string, FakeClerkUser>();

export const tokenFor = (clerkId: string) => `test:${clerkId}`;

export async function verifyToken(token: string) {
  const clerkId = token.startsWith('test:') ? token.slice('test:'.length) : '';
  if (!fakeClerkUsers.has(clerkId)) throw new Error('Invalid token');
  return { sub: clerkId };
}

export const clerkClient = {
  users: {
    async getUser(clerkId: string) {
      const user = fakeClerkUsers.get(clerkId);
      if (!user) throw new Error('Not found');
      return {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        primaryEmailAddressId: user.email ? 'email_1' : null,
        emailAddresses: user.email
          ? [{ id: 'email_1', emailAddress: user.email, verification: { status: user.emailVerified === false ? 'unverified' : 'verified' } }]
          : [],
      };
    },
  },
};
