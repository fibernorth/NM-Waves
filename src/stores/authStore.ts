import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import type { User, UserRole } from '@/types/models';

interface AuthState {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => void;
}

const defaultPermissions = {
  canEditRosters: false,
  canViewFinancials: false,
  canManageSchedules: false,
  canUploadMedia: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  initialized: false,

  initialize: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          set({
            user: {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: userData.displayName,
              role: userData.role,
              teamIds: userData.teamIds || [],
              linkedPlayerIds: userData.linkedPlayerIds || [],
              permissions: userData.permissions || defaultPermissions,
              createdAt: userData.createdAt?.toDate(),
              updatedAt: userData.updatedAt?.toDate(),
            },
            firebaseUser,
            loading: false,
            initialized: true,
          });
        } else {
          set({ user: null, firebaseUser: null, loading: false, initialized: true });
        }
      } else {
        set({ user: null, firebaseUser: null, loading: false, initialized: true });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        set({
          user: {
            uid: userCredential.user.uid,
            email: userCredential.user.email!,
            displayName: userData.displayName,
            role: userData.role,
            teamIds: userData.teamIds || [],
            linkedPlayerIds: userData.linkedPlayerIds || [],
            permissions: userData.permissions || defaultPermissions,
            createdAt: userData.createdAt?.toDate(),
            updatedAt: userData.updatedAt?.toDate(),
          },
          firebaseUser: userCredential.user,
          loading: false,
        });
      }
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signUp: async (email: string, password: string, displayName: string, role: UserRole = 'parent') => {
    set({ loading: true });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      const newUser: User = {
        uid: userCredential.user.uid,
        email: userCredential.user.email!,
        displayName,
        role,
        teamIds: [],
        linkedPlayerIds: [],
        permissions: defaultPermissions,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...newUser,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      set({
        user: newUser,
        firebaseUser: userCredential.user,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, firebaseUser: null });
  },
}));
