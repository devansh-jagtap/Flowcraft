import { useClerk, useUser } from '@clerk/react';
import { useMemo } from 'react';
import type { User } from '../api/types';

interface AuthValue {
  user: User | null;
  /** False until Clerk knows whether there is a signed-in session. */
  ready: boolean;
  logout: () => Promise<void>;
}

/** The signed-in Clerk user in the shape the rest of the app uses. */
export function useAuth(): AuthValue {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const user = useMemo<User | null>(() => {
    if (!clerkUser) return null;
    const email = clerkUser.primaryEmailAddress?.emailAddress ?? '';
    return {
      id: clerkUser.id,
      name: clerkUser.fullName || clerkUser.username || email.split('@')[0] || 'there',
      email,
      createdAt: (clerkUser.createdAt ?? new Date()).toISOString(),
    };
  }, [clerkUser]);

  return { user, ready: isLoaded, logout: () => signOut() };
}
