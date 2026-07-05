import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';

export interface BroadcastResult {
  recipientCount: number;
  sent: number;
  queued: boolean;
}

/**
 * Email all active players' parents/guardians. Admin only (enforced server-side).
 */
export const emailAllParents = async (subject: string, message: string): Promise<BroadcastResult> => {
  const callable = httpsCallable<{ subject: string; message: string }, BroadcastResult>(
    functions,
    'emailAllParents'
  );
  const res = await callable({ subject, message });
  return res.data;
};
