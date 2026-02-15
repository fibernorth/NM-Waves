import type { User, UserRole } from '@/types/models';

/** Check if user holds a specific role */
export function hasRole(user: User | null | undefined, role: UserRole): boolean {
  return user?.roles?.includes(role) ?? false;
}

/** Has 'admin' or 'master-admin' */
export function isAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'admin') || hasRole(user, 'master-admin');
}

/** Has 'coach', or is admin */
export function isCoach(user: User | null | undefined): boolean {
  return hasRole(user, 'coach') || isAdmin(user);
}

/** Has 'master-admin' */
export function isMasterAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'master-admin');
}

/** Has 'parent' */
export function isParent(user: User | null | undefined): boolean {
  return hasRole(user, 'parent');
}

/** Has 'sponsor' */
export function isSponsor(user: User | null | undefined): boolean {
  return hasRole(user, 'sponsor');
}

const ROLE_PRIORITY: UserRole[] = ['master-admin', 'admin', 'coach', 'parent', 'sponsor', 'visitor'];

/** Returns the highest-privilege role for display purposes */
export function primaryRole(user: User | null | undefined): UserRole {
  if (!user?.roles?.length) return 'visitor';
  for (const role of ROLE_PRIORITY) {
    if (user.roles.includes(role)) return role;
  }
  return user.roles[0];
}
