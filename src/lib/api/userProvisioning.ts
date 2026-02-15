import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Player, PlayerContact } from '@/types/models';

interface PendingUser {
  email: string;
  displayName: string;
  roles: string[];
  teamIds: string[];
  linkedPlayerIds: string[];
  permissions: {
    canEditRosters: boolean;
    canViewFinancials: boolean;
    canManageSchedules: boolean;
    canUploadMedia: boolean;
  };
  status: 'pending' | 'active';
  createdAt: any;
  updatedAt: any;
}

export const userProvisioningApi = {
  /**
   * Provision a parent user account from a player contact.
   * Creates a Firestore doc in /pendingUsers with role=parent.
   * When the user signs up with this email, they get linked automatically.
   */
  provisionFromContact: async (
    contact: PlayerContact,
    player: Player
  ): Promise<string> => {
    // Check if user already exists in users collection
    const existingUserQuery = query(
      collection(db, 'users'),
      where('email', '==', contact.email)
    );
    const existingSnapshot = await getDocs(existingUserQuery);

    if (!existingSnapshot.empty) {
      // User exists - just ensure the player is linked
      const existingDoc = existingSnapshot.docs[0];
      const existingData = existingDoc.data();
      const linkedPlayerIds: string[] = existingData.linkedPlayerIds || [];

      if (!linkedPlayerIds.includes(player.id)) {
        linkedPlayerIds.push(player.id);
        const teamIds: string[] = existingData.teamIds || [];
        if (player.teamId && !teamIds.includes(player.teamId)) {
          teamIds.push(player.teamId);
        }
        await setDoc(doc(db, 'users', existingDoc.id), {
          ...existingData,
          linkedPlayerIds,
          teamIds,
          updatedAt: Timestamp.now(),
        });
      }
      return existingDoc.id;
    }

    // Check pendingUsers collection
    const pendingQuery = query(
      collection(db, 'pendingUsers'),
      where('email', '==', contact.email)
    );
    const pendingSnapshot = await getDocs(pendingQuery);

    if (!pendingSnapshot.empty) {
      // Already pending - update linked players
      const pendingDoc = pendingSnapshot.docs[0];
      const pendingData = pendingDoc.data();
      const linkedPlayerIds: string[] = pendingData.linkedPlayerIds || [];

      if (!linkedPlayerIds.includes(player.id)) {
        linkedPlayerIds.push(player.id);
        const teamIds: string[] = pendingData.teamIds || [];
        if (player.teamId && !teamIds.includes(player.teamId)) {
          teamIds.push(player.teamId);
        }
        await setDoc(doc(db, 'pendingUsers', pendingDoc.id), {
          ...pendingData,
          linkedPlayerIds,
          teamIds,
          updatedAt: Timestamp.now(),
        });
      }
      return pendingDoc.id;
    }

    // Create new pending user
    const pendingUser: PendingUser = {
      email: contact.email,
      displayName: contact.name,
      roles: ['parent'],
      teamIds: player.teamId ? [player.teamId] : [],
      linkedPlayerIds: [player.id],
      permissions: {
        canEditRosters: false,
        canViewFinancials: true, // Parents can view their own kids' financials
        canManageSchedules: false,
        canUploadMedia: false,
      },
      status: 'pending',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Use email as doc ID (sanitized)
    const docId = contact.email.replace(/[^a-zA-Z0-9]/g, '_');
    await setDoc(doc(db, 'pendingUsers', docId), pendingUser);
    return docId;
  },

  /**
   * Provision accounts for ALL contacts of a player
   */
  provisionAllContacts: async (player: Player): Promise<string[]> => {
    const ids: string[] = [];
    for (const contact of player.contacts) {
      if (contact.email) {
        const id = await userProvisioningApi.provisionFromContact(contact, player);
        ids.push(id);
      }
    }
    return ids;
  },

  /**
   * Get all pending users
   */
  getPending: async (): Promise<Array<PendingUser & { id: string }>> => {
    const q = query(
      collection(db, 'pendingUsers'),
      where('status', '==', 'pending')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Array<PendingUser & { id: string }>;
  },

  /**
   * Bulk provision: scan all players and create pending accounts for all contacts
   */
  provisionAllPlayerContacts: async (): Promise<{ created: number; existing: number }> => {
    const playersSnapshot = await getDocs(collection(db, 'players'));
    let created = 0;
    let existing = 0;

    for (const playerDoc of playersSnapshot.docs) {
      const data = playerDoc.data();
      const contacts = data.contacts || [];

      // Also handle legacy parentEmail
      const emails = new Set<string>();
      for (const contact of contacts) {
        if (contact.email) emails.add(contact.email);
      }
      if (data.parentEmail && !emails.has(data.parentEmail)) {
        emails.add(data.parentEmail);
        contacts.push({
          name: data.parentName || '',
          relationship: 'Parent',
          email: data.parentEmail,
          phone: data.parentPhone || '',
          isPrimaryContact: true,
          isFinancialParty: true,
        });
      }

      const player = {
        id: playerDoc.id,
        teamId: data.teamId,
        contacts,
      } as Player;

      for (const contact of contacts) {
        if (!contact.email) continue;

        // Check if already exists
        const existingQuery = query(
          collection(db, 'users'),
          where('email', '==', contact.email)
        );
        const existingSnapshot = await getDocs(existingQuery);
        if (!existingSnapshot.empty) {
          existing++;
          continue;
        }

        const pendingQuery = query(
          collection(db, 'pendingUsers'),
          where('email', '==', contact.email)
        );
        const pendingSnapshot = await getDocs(pendingQuery);
        if (!pendingSnapshot.empty) {
          existing++;
          continue;
        }

        await userProvisioningApi.provisionFromContact(contact, player);
        created++;
      }
    }

    return { created, existing };
  },
};
