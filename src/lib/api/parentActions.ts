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
}

/**
 * Search for players the parent can link. Returns only non-sensitive fields
 * (no DOB, medical notes, contacts, or emails) plus a server-computed
 * emailMatch flag. Email-matched children are always returned; other players
 * only appear when a search term of 2+ characters is provided.
 */
export const searchLinkablePlayers = async (search: string): Promise<LinkablePlayer[]> => {
  const callable = httpsCallable<{ search: string }, { players: LinkablePlayer[] }>(
    functions,
    'searchLinkablePlayers'
  );
  const result = await callable({ search });
  return result.data?.players || [];
};

/**
 * Link a child to the current parent account. Verified server-side: the
 * parent's email must match the player's parent/contact email, otherwise an
 * administrator must perform the link.
 */
export const linkChild = async (playerId: string): Promise<void> => {
  const callable = httpsCallable<{ playerId: string }, { success: boolean }>(
    functions,
    'linkChild'
  );
  await callable({ playerId });
};
