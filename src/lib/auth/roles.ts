import type { User, Player, UserRole } from '@/types/models';

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

/** Can this user view a specific player's profile? */
export function canViewPlayer(user: User | null | undefined, player: Player | null | undefined): boolean {
  if (!user || !player) return false;
  if (isAdmin(user)) return true;
  // Coach on the same team
  if (isCoach(user) && player.teamId && user.teamIds?.includes(player.teamId)) return true;
  // Parent with linked child
  if (user.linkedPlayerIds?.includes(player.id)) return true;
  return false;
}

/** Can this user view a player's financial details (invoices, balances)? */
export function canViewPlayerFinances(user: User | null | undefined, player: Player | null | undefined): boolean {
  if (!user || !player) return false;
  if (isAdmin(user)) return true;
  // Parent with linked child
  if (user.linkedPlayerIds?.includes(player.id)) return true;
  return false;
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
