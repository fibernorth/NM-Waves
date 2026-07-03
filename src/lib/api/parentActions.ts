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
