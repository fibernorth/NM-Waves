import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';

export interface PublicRosterPlayer {
  firstName: string;
  lastInitial: string;
  jerseyNumber?: number;
  positions: string[];
}

/**
 * Fetch a sanitized public roster (safe fields only) for a team via Cloud
 * Function. The /players collection is not publicly readable — full player
 * docs contain minors' DOB, medical notes, and emergency contacts.
 */
export const getPublicRoster = async (teamId: string): Promise<PublicRosterPlayer[]> => {
  const callable = httpsCallable<{ teamId: string }, { players: PublicRosterPlayer[] }>(
    functions,
    'getPublicRoster'
  );
  const result = await callable({ teamId });
  return (result.data?.players || []).map((p) => ({
    firstName: p.firstName || '',
    lastInitial: p.lastInitial || '',
    jerseyNumber: p.jerseyNumber ?? undefined,
    positions: p.positions || [],
  }));
};
