import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';

export interface BroadcastResult {
  recipientCount: number;
  sent: number;
  queued: boolean;
}

/**
 * Email active players' parents/guardians. Admin only (enforced server-side).
 * With no filters, everyone is emailed; teamIds/playerIds narrow the audience
 * (union of players on selected teams + individually selected players).
 */
export const emailAllParents = async (
  subject: string,
  message: string,
  filters?: { teamIds?: string[]; playerIds?: string[]; tryoutSignups?: boolean; tryoutApplicantIds?: string[] }
): Promise<BroadcastResult> => {
  const callable = httpsCallable<
    { subject: string; message: string; teamIds?: string[]; playerIds?: string[]; tryoutSignups?: boolean; tryoutApplicantIds?: string[] },
    BroadcastResult
  >(functions, 'emailAllParents');
  const res = await callable({
    subject,
    message,
    teamIds: filters?.teamIds || [],
    playerIds: filters?.playerIds || [],
    tryoutSignups: filters?.tryoutSignups || false,
    tryoutApplicantIds: filters?.tryoutApplicantIds || [],
  });
  return res.data;
};
