import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const getDb = () => admin.firestore();

interface ContactInput {
  name?: string;
  relationship?: string;
  email?: string;
  phone?: string;
  isPrimaryContact?: boolean;
  isFinancialParty?: boolean;
}

interface UpdateLinkedPlayerContactInput {
  playerId: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  contacts?: ContactInput[];
}

/**
 * Lets a parent update the contact / emergency / medical fields on a player
 * they are linked to. Parents cannot write the /players collection directly
 * (that is coach-only), so onboarding "Save & Continue" used to always fail
 * with a permissions error. This callable enforces that the caller is a parent
 * linked to the player and writes ONLY the allowed fields — never roster,
 * financial, or team assignment fields.
 */
export const updateLinkedPlayerContact = functions.https.onCall(
  async (data: UpdateLinkedPlayerContactInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
    }
    const { playerId } = data;
    if (!playerId) {
      throw new functions.https.HttpsError('invalid-argument', 'playerId is required');
    }

    const userDoc = await getDb().collection('users').doc(context.auth.uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Unknown user');
    }
    const userData = userDoc.data()!;
    const roles: string[] = userData.roles || (userData.role ? [userData.role] : []);
    const linkedPlayerIds: string[] = userData.linkedPlayerIds || [];

    const isParent = roles.includes('parent');
    const isLinked = linkedPlayerIds.includes(playerId);
    if (!isParent || !isLinked) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You can only update a child linked to your account'
      );
    }

    // Whitelist of fields a parent may update — nothing else is written.
    const allowed: Record<string, any> = { updatedAt: admin.firestore.Timestamp.now() };
    if (data.parentName !== undefined) allowed.parentName = data.parentName;
    if (data.parentEmail !== undefined) allowed.parentEmail = data.parentEmail;
    if (data.parentPhone !== undefined) allowed.parentPhone = data.parentPhone;
    if (data.emergencyContact !== undefined) allowed.emergencyContact = data.emergencyContact;
    if (data.emergencyPhone !== undefined) allowed.emergencyPhone = data.emergencyPhone;
    if (data.medicalNotes !== undefined) allowed.medicalNotes = data.medicalNotes;
    if (Array.isArray(data.contacts)) {
      allowed.contacts = data.contacts.map((c) => ({
        name: c.name || '',
        relationship: c.relationship || '',
        email: c.email || '',
        phone: c.phone || '',
        isPrimaryContact: c.isPrimaryContact || false,
        isFinancialParty: c.isFinancialParty || false,
      }));
    }

    await getDb().collection('players').doc(playerId).update(allowed);
    return { success: true };
  }
);
