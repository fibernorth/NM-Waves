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
  refreshUser: () => Promise<void>;
}

const defaultPermissions = {
  canEditRosters: false,
  canViewFinancials: false,
  canManageSchedules: false,
  canUploadMedia: false,
};

// Flag to prevent onAuthStateChanged from racing with signIn
let signInActive = false;

async function loadUserProfile(uid: string, email: string, firebaseUser: FirebaseUser) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (userDoc.exists()) {
    const userData = userDoc.data();
    // A disabled account must never load a session. The Auth account is also
    // disabled server-side, but this guards the client immediately (and covers
    // any doc flagged before the Auth change propagates).
    if (userData.disabled === true) {
      await firebaseSignOut(auth);
      throw new Error('This account has been disabled. Please contact your club administrator.');
    }
    return {
      user: {
        uid,
        email,
        displayName: userData.displayName,
        roles: userData.roles || (userData.role ? [userData.role] : ['visitor']),
        teamIds: userData.teamIds || [],
        linkedPlayerIds: userData.linkedPlayerIds || [],
        permissions: userData.permissions || defaultPermissions,
        createdAt: userData.createdAt?.toDate(),
        updatedAt: userData.updatedAt?.toDate(),
      } as User,
      firebaseUser,
    };
  }
  return null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firebaseUser: null,
  loading: true,
  initialized: false,

  initialize: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged:', firebaseUser?.uid || 'null', 'signInActive:', signInActive);

      // If signIn is currently running, let it handle everything
      if (signInActive) {
        console.log('[Auth] signIn active, skipping onAuthStateChanged');
        return;
      }

      if (firebaseUser) {
        // If user is already loaded with this UID, just mark initialized
        const current = useAuthStore.getState();
        if (current.user?.uid === firebaseUser.uid) {
          console.log('[Auth] User already loaded, marking initialized');
          set({ loading: false, initialized: true });
          return;
        }

        try {
          console.log('[Auth] Loading user profile from onAuthStateChanged...');
          const result = await loadUserProfile(firebaseUser.uid, firebaseUser.email!, firebaseUser);
          if (result) {
            console.log('[Auth] User profile loaded successfully:', result.user.displayName);
            set({ ...result, loading: false, initialized: true });
          } else {
            console.warn('[Auth] User doc not found in Firestore');
            set({ user: null, firebaseUser: null, loading: false, initialized: true });
          }
        } catch (err) {
          console.error('[Auth] Failed to load user profile:', err);
          // Don't clear user state - signIn may have set it
          set({ loading: false, initialized: true });
        }
      } else {
        console.log('[Auth] No firebase user, clearing state');
        set({ user: null, firebaseUser: null, loading: false, initialized: true });
      }
    });
  },

  signIn: async (email: string, password: string) => {
    signInActive = true;
    set({ loading: true });
    try {
      console.log('[Auth] signIn starting...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('[Auth] Firebase auth succeeded, loading profile...');

      const result = await loadUserProfile(userCredential.user.uid, userCredential.user.email!, userCredential.user);
      if (result) {
        console.log('[Auth] Profile loaded:', result.user.displayName, 'roles:', result.user.roles);
        set({ ...result, loading: false, initialized: true });
      } else {
        console.error('[Auth] User profile not found in Firestore');
        set({ loading: false, initialized: true });
        throw new Error('User profile not found. Please contact an administrator.');
      }
    } catch (error) {
      console.error('[Auth] signIn error:', error);
      set({ loading: false, initialized: true });
      throw error;
    } finally {
      signInActive = false;
    }
  },

  signUp: async (email: string, password: string, displayName: string, role: UserRole = 'parent') => {
    signInActive = true;
    set({ loading: true });
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      const newUser: User = {
        uid: userCredential.user.uid,
        email: userCredential.user.email!,
        displayName,
        roles: [role],
        teamIds: [],
        linkedPlayerIds: [],
        permissions: defaultPermissions,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        ...newUser,
        onboardingComplete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      set({
        user: newUser,
        firebaseUser: userCredential.user,
        loading: false,
        initialized: true,
      });
    } catch (error) {
      set({ loading: false, initialized: true });
      throw error;
    } finally {
      signInActive = false;
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, firebaseUser: null });
  },

  refreshUser: async () => {
    const { firebaseUser } = useAuthStore.getState();
    if (!firebaseUser) return;
    try {
      const result = await loadUserProfile(firebaseUser.uid, firebaseUser.email!, firebaseUser);
      if (result) {
        set({ user: result.user, firebaseUser: result.firebaseUser });
      }
    } catch (err) {
      console.error('[Auth] Failed to refresh user profile:', err);
    }
  },
}));
