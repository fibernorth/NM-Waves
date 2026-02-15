import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from '@/lib/firebase/config';
import type { User, UserRole } from '@/types/models';

const COLLECTION = 'users';

const convertUser = (id: string, data: any): User => ({
  uid: id,
  email: data.email,
  displayName: data.displayName,
  role: data.role,
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

  // Get users by role
  getByRole: async (role: UserRole): Promise<User[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('role', '==', role),
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

  // Update user (role, permissions, teamIds)
  update: async (
    uid: string,
    userData: Partial<Pick<User, 'role' | 'permissions' | 'teamIds'>>
  ): Promise<void> => {
    const docRef = doc(db, COLLECTION, uid);
    await updateDoc(docRef, {
      ...userData,
      updatedAt: Timestamp.now(),
    });
  },

  // Create a new user (auth account + Firestore doc)
  // Uses a secondary Firebase app so the current admin session is not affected
  create: async (data: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
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
      await setDoc(doc(db, COLLECTION, uid), {
        email: data.email,
        displayName: data.displayName,
        role: data.role,
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
      });

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

  // Delete user document
  delete: async (uid: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, uid);
    await deleteDoc(docRef);
  },
};
