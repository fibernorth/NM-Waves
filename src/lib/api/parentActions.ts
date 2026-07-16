import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
import type { PlayerContact } from '@/types/models';

interface UpdateLinkedPlayerContactInput {
  playerId: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  contacts?: PlayerContact[];
}

/**
 * Update the contact / emergency / medical fields on a child linked to the
 * current parent account. Routed through a Cloud Function because parents
 * cannot write the /players collection directly.
 */
export const updateLinkedPlayerContact = async (
  input: UpdateLinkedPlayerContactInput
): Promise<void> => {
  const callable = httpsCallable<UpdateLinkedPlayerContactInput, { success: boolean }>(
    functions,
    'updateLinkedPlayerContact'
  );
  await callable(input);
};

export interface LinkablePlayer {
  id: string;
  firstName: string;
  lastName: string;
  teamName: string;
  emailMatch: boolean;
  /** Parent's typed phone matches a number on the player (and email did not). */
  phoneMatch: boolean;
  /** Player has no parent attached yet — can be self-claimed by phone. */
  claimable: boolean;
}

/**
 * Search for players the parent can link. Returns only non-sensitive fields
 * (no DOB, medical notes, contacts, or emails) plus server-computed match
 * flags. Email- and phone-matched children are always returned; other players
 * only appear when a search term of 2+ characters is provided.
 */
export const searchLinkablePlayers = async (
  search: string,
  phone?: string
): Promise<LinkablePlayer[]> => {
  const callable = httpsCallable<
    { search: string; phone?: string },
    { players: LinkablePlayer[] }
  >(functions, 'searchLinkablePlayers');
  const result = await callable({ search, phone });
  return result.data?.players || [];
};

interface LinkChildInput {
  playerId: string;
  /** Parent phone for a phone-based claim of an unattached player. */
  phone?: string;
  parentName?: string;
  parentEmail?: string;
}

/**
 * Link a child to the current parent account. Verified server-side: the
 * parent's email must match the player's parent/contact email, OR — for a
 * player with no parent attached yet — the parent's typed phone must match a
 * number on the player record. On a phone claim the parent's contact details
 * are written onto the player. Otherwise an administrator must perform the link.
 */
export const linkChild = async (input: string | LinkChildInput): Promise<void> => {
  const payload: LinkChildInput = typeof input === 'string' ? { playerId: input } : input;
  const callable = httpsCallable<LinkChildInput, { success: boolean; method?: string }>(
    functions,
    'linkChild'
  );
  await callable(payload);
};

/**
 * Add a player's current team to every linked parent's teamIds. Called from the
 * placement flow so parents stay attached to their child's team even when the
 * child is placed or moved after the parent linked. Coach/admin only; idempotent.
 */
export const syncLinkedParentTeams = async (playerId: string): Promise<void> => {
  const callable = httpsCallable<{ playerId: string }, { updated: number }>(
    functions,
    'syncLinkedParentTeams'
  );
  await callable({ playerId });
};
