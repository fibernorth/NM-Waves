import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db } from '@/lib/firebase/config';
import { storage } from '@/lib/firebase/config';
import type { Player, PlayerDocument, PlayerDocumentType } from '@/types/models';
import { isResizableImage, resizeImage } from '@/lib/utils/imageResize';

const COLLECTION = 'players';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertPlayer = (id: string, data: any): Player => ({
  id,
  firstName: data.firstName,
  lastName: data.lastName,
  dateOfBirth: data.dateOfBirth?.toDate(),
  teamId: data.teamId,
  teamName: data.teamName,
  jerseyNumber: data.jerseyNumber,
  gradYear: data.gradYear,
  positions: data.positions || [],
  bats: data.bats,
  throws: data.throws,
  contacts: (data.contacts || []).map((c: any) => ({
    name: c.name || '',
    relationship: c.relationship || '',
    email: c.email || '',
    phone: c.phone || '',
    isPrimaryContact: c.isPrimaryContact || false,
    isFinancialParty: c.isFinancialParty || false,
  })),
  parentName: data.parentName || '',
  parentEmail: data.parentEmail || '',
  parentPhone: data.parentPhone || '',
  emergencyContact: data.emergencyContact || '',
  emergencyPhone: data.emergencyPhone || '',
  medicalNotes: data.medicalNotes,
  notes: data.notes,
  playingUpFrom: data.playingUpFrom || undefined,
  documents: (data.documents || []).map((d: any) => ({
    id: d.id || '',
    type: d.type || 'other',
    label: d.label || '',
    fileUrl: d.fileUrl || '',
    fileName: d.fileName || '',
    fileSize: d.fileSize || 0,
    uploadedBy: d.uploadedBy || '',
    uploadedByName: d.uploadedByName || '',
    uploadedAt: d.uploadedAt?.toDate?.() || new Date(d.uploadedAt) || new Date(),
  })),
  active: data.active,
  status: data.status || (data.active ? 'active' : 'inactive'),
  quitDate: data.quitDate?.toDate?.() || undefined,
  quitReason: data.quitReason || undefined,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const playersApi = {
  // Get all players
  getAll: async (): Promise<Player[]> => {
    const q = query(collection(db, COLLECTION), orderBy('lastName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayer(doc.id, doc.data()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get active players
  getActive: async (): Promise<Player[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('active', '==', true),
      orderBy('lastName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertPlayer(doc.id, doc.data()))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get players by team (tries teamId first, falls back to teamName match, auto-fixes mismatched IDs)
  getByTeam: async (teamId: string, teamName?: string): Promise<Player[]> => {
    // Primary query: match by teamId
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
    );
    const snapshot = await getDocs(q);
    let players = snapshot.docs.map(d => convertPlayer(d.id, d.data()));

    // Fallback: if no players found by teamId and teamName is provided,
    // fetch ALL players and match by teamName client-side.
    // This avoids needing a composite Firestore index on teamName.
    if (players.length === 0 && teamName) {
      const allSnap = await getDocs(collection(db, COLLECTION));
      const allPlayers = allSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
      const matched = allPlayers.filter((p: any) => p.teamName === teamName);
      players = matched.map((p: any) => convertPlayer(p.docId, p));

      // Auto-heal: fix teamId on all matched players so future queries work directly
      for (const player of players) {
        if (player.teamId !== teamId) {
          await updateDoc(doc(db, COLLECTION, player.id), cleanData({
            teamId,
            updatedAt: Timestamp.now(),
          }));
          player.teamId = teamId;
        }
      }
    }

    return players.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  },

  // Get player by ID
  getById: async (id: string): Promise<Player | null> => {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertPlayer(docSnap.id, docSnap.data()) : null;
  },

  // Create player
  create: async (playerData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), cleanData({
      ...playerData,
      dateOfBirth: playerData.dateOfBirth ? Timestamp.fromDate(playerData.dateOfBirth) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  // Update player
  update: async (id: string, playerData: Partial<Player>): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    const updateData: any = {
      ...playerData,
      updatedAt: Timestamp.now(),
    };

    if (playerData.dateOfBirth) {
      updateData.dateOfBirth = Timestamp.fromDate(playerData.dateOfBirth);
    }

    await updateDoc(docRef, cleanData(updateData));
  },

  // Soft-delete player (archive instead of hard delete to preserve financial records)
  delete: async (id: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, id);
    await updateDoc(docRef, {
      active: false,
      status: 'inactive',
      teamId: null,
      teamName: null,
      updatedAt: Timestamp.now(),
      deletedAt: Timestamp.now(),
    });

    // Clean up team roster references
    const teamsQuery = query(collection(db, 'teams'), where('playerIds', 'array-contains', id));
    const teamsSnap = await getDocs(teamsQuery);
    for (const teamDoc of teamsSnap.docs) {
      const teamData = teamDoc.data();
      const updatedIds = (teamData.playerIds || []).filter((pid: string) => pid !== id);
      await updateDoc(teamDoc.ref, { playerIds: updatedIds, updatedAt: Timestamp.now() });
    }

    // Clean up parent user linkedPlayerIds
    const usersQuery = query(collection(db, 'users'), where('linkedPlayerIds', 'array-contains', id));
    const usersSnap = await getDocs(usersQuery);
    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const updatedIds = (userData.linkedPlayerIds || []).filter((pid: string) => pid !== id);
      await updateDoc(userDoc.ref, { linkedPlayerIds: updatedIds, updatedAt: Timestamp.now() });
    }
  },

  // Assign to team
  assignToTeam: async (playerId: string, teamId: string, teamName: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, cleanData({
      teamId,
      teamName,
      updatedAt: Timestamp.now(),
    }));
  },

  // Remove from team
  removeFromTeam: async (playerId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, cleanData({
      teamId: null,
      teamName: null,
      updatedAt: Timestamp.now(),
    }));
  },

  // Mark player as quit — sets status, removes from team, keeps finance records
  markAsQuit: async (playerId: string, reason?: string): Promise<void> => {
    if (!playerId) throw new Error('Player ID is required');
    const docRef = doc(db, COLLECTION, playerId);
    const updateData: Record<string, unknown> = {
      active: false,
      status: 'quit',
      quitDate: Timestamp.now(),
      teamId: null,
      teamName: null,
      updatedAt: Timestamp.now(),
    };
    if (reason) updateData.quitReason = reason;
    await updateDoc(docRef, updateData);
  },

  // Reactivate a quit player
  reactivate: async (playerId: string): Promise<void> => {
    if (!playerId) throw new Error('Player ID is required');
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, {
      active: true,
      status: 'active',
      quitDate: null,
      quitReason: null,
      updatedAt: Timestamp.now(),
    });
  },

  // Upload a document (birth certificate, etc.) for a player
  uploadDocument: async (
    playerId: string,
    file: File,
    docType: PlayerDocumentType,
    label: string,
    uploadedBy: string,
    uploadedByName: string,
  ): Promise<PlayerDocument> => {
    const timestamp = Date.now();
    const storagePath = `player-documents/${playerId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    // Resize images before upload (skip PDFs/docs)
    let fileToUpload = file;
    if (isResizableImage(file)) {
      fileToUpload = await resizeImage(file, { maxDimension: 1920, quality: 0.85 });
    }

    await uploadBytes(storageRef, fileToUpload);
    const fileUrl = await getDownloadURL(storageRef);

    const playerDoc: PlayerDocument = {
      id: `${timestamp}`,
      type: docType,
      label,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
      uploadedBy,
      uploadedByName,
      uploadedAt: new Date(),
    };

    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, cleanData({
      documents: arrayUnion({
        ...playerDoc,
        uploadedAt: Timestamp.now(),
      }),
      updatedAt: Timestamp.now(),
    }));

    return playerDoc;
  },

  // Update compliance acknowledgment for a player
  acknowledgeCompliance: async (
    playerId: string,
    complianceKey: 'concussionProtocol' | 'waiver' | 'playerConduct' | 'parentConduct',
    acknowledgedBy: string,
    acknowledgedByName: string,
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, playerId);
    await updateDoc(docRef, cleanData({
      [`compliance.${complianceKey}`]: {
        acknowledgedAt: Timestamp.now(),
        acknowledgedBy,
        acknowledgedByName,
      },
      updatedAt: Timestamp.now(),
    }));
  },

  // Delete a document from a player
  deleteDocument: async (playerId: string, playerDocument: PlayerDocument): Promise<void> => {
    // Remove from storage
    try {
      const storagePath = `player-documents/${playerId}/${playerDocument.id}_${playerDocument.fileName}`;
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch {
      // File may already be deleted from storage
    }

    // Remove from player's documents array
    // Since arrayRemove needs exact match, we fetch and filter
    const docRef = doc(db, COLLECTION, playerId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      const docs = (data.documents || []).filter((d: any) => d.id !== playerDocument.id);
      await updateDoc(docRef, cleanData({
        documents: docs,
        updatedAt: Timestamp.now(),
      }));
    }
  },
};
