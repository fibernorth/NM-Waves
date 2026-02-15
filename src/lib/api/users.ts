import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
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

  // Delete user document
  delete: async (uid: string): Promise<void> => {
    const docRef = doc(db, COLLECTION, uid);
    await deleteDoc(docRef);
  },
};
