import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase/config';
import type { User, UserRole } from '@/types/models';

const COLLECTION = 'users';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const convertUser = (id: string, data: any): User => ({
  uid: id,
  email: data.email,
  displayName: data.displayName,
  roles: data.roles || (data.role ? [data.role] : ['visitor']),
  teamIds: data.teamIds || [],
  linkedPlayerIds: data.linkedPlayerIds || [],
  permissions: {
    canEditRosters: data.permissions?.canEditRosters ?? false,
    canViewFinancials: data.permissions?.canViewFinancials ?? false,
    canManageSchedules: data.permissions?.canManageSchedules ?? false,
    canUploadMedia: data.permissions?.canUploadMedia ?? false,
  },
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const usersApi = {
  // Get all users ordered by displayName
  getAll: async (): Promise<User[]> => {
    const q = query(collection(db, COLLECTION), orderBy('displayName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertUser(doc.id, doc.data()));
  },

  // Get users by role (uses array-contains for the roles array)
  getByRole: async (role: UserRole): Promise<User[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('roles', 'array-contains', role),
      orderBy('displayName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => convertUser(doc.id, doc.data()));
  },

  // Get user by uid (document ID)
  getById: async (uid: string): Promise<User | null> => {
    const docRef = doc(db, COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? convertUser(docSnap.id, docSnap.data()) : null;
  },

  // Update user (roles, permissions, teamIds, linkedPlayerIds)
  update: async (
    uid: string,
    userData: Partial<Pick<User, 'roles' | 'permissions' | 'teamIds' | 'linkedPlayerIds'>>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, uid);
    await updateDoc(docRef, cleanData({
      ...userData,
      updatedAt: Timestamp.now(),
    }));
  },

  /**
   * Admin-only: change a user's login email and/or set a new password. Runs
   * through a Cloud Function because these are Firebase Auth operations. The
   * function keeps the Firestore `email` mirror in sync and refuses to reset an
   * admin/master-admin password.
   */
  updateAuth: async (
    uid: string,
    changes: { email?: string; password?: string }
  ): Promise<{ emailChanged: boolean; passwordChanged: boolean }> => {
    const callable = httpsCallable<
      { uid: string; email?: string; password?: string },
      { success: boolean; emailChanged: boolean; passwordChanged: boolean }
    >(functions, 'adminUpdateUserAuth');
    const res = await callable({ uid, ...changes });
    return { emailChanged: !!res.data?.emailChanged, passwordChanged: !!res.data?.passwordChanged };
  },

  // Create a new user (auth account + Firestore doc)
  // Uses a secondary Firebase app so the current admin session is not affected
  create: async (data: {
    email: string;
    password: string;
    displayName: string;
    roles: UserRole[];
    permissions?: User['permissions'];
    teamIds?: string[];
  }): Promise<string> => {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

    // Create secondary app to avoid signing out the current admin
    const existing = getApps().find(a => a.name === 'userCreator');
    if (existing) await deleteApp(existing);
    const secondaryApp = initializeApp(firebaseConfig, 'userCreator');
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      const uid = cred.user.uid;

      // Create user doc in Firestore
      await setDoc(doc(db, COLLECTION, uid), cleanData({
        email: data.email,
        displayName: data.displayName,
        roles: data.roles,
        teamIds: data.teamIds || [],
        linkedPlayerIds: [],
        permissions: data.permissions || {
          canEditRosters: false,
          canViewFinancials: false,
          canManageSchedules: false,
          canUploadMedia: false,
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }));

      // Sign out and clean up the secondary app
      await secondaryAuth.signOut();
      await deleteApp(secondaryApp);

      return uid;
    } catch (error) {
      // Clean up on failure
      try {
        await secondaryAuth.signOut();
        await deleteApp(secondaryApp);
      } catch { /* ignore cleanup errors */ }
      throw error;
    }
  },

  // Add a linked player to a user's linkedPlayerIds array
  addLinkedPlayer: async (uid: string, playerId: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, uid);
    await updateDoc(docRef, cleanData({
      linkedPlayerIds: arrayUnion(playerId),
      updatedAt: Timestamp.now(),
    }));
  },

  // Disable a user — routed through a Cloud Function that disables the Firebase
  // Auth account (so they truly can't sign in) and mirrors the flag onto the
  // doc. Admin-gated; can't disable an admin/master-admin (unless master) or self.
  delete: async (uid: string): Promise<void> => {
    const callable = httpsCallable<{ uid: string; disabled: boolean }, { success: boolean }>(
      functions,
      'adminSetUserDisabled'
    );
    await callable({ uid, disabled: true });
  },

  // Re-enable a previously disabled user.
  setDisabled: async (uid: string, disabled: boolean): Promise<void> => {
    const callable = httpsCallable<{ uid: string; disabled: boolean }, { success: boolean }>(
      functions,
      'adminSetUserDisabled'
    );
    await callable({ uid, disabled });
  },
};
