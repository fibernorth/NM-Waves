import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { SwagStoreSettings } from '@/types/models';

const SWAG_STORE_DOC = 'siteSettings/swagStore';

const DEFAULT_SWAG_STORE: SwagStoreSettings = {
  url: '',
  label: 'Shop TC Waves Gear!',
  closesAt: null,
  active: false,
  updatedBy: '',
  updatedAt: new Date(),
};

/** Convert Firestore Timestamps to JS Dates */
const fromFirestore = (data: Record<string, unknown>): SwagStoreSettings => ({
  url: (data.url as string) || '',
  label: (data.label as string) || 'Shop TC Waves Gear!',
  closesAt: data.closesAt instanceof Timestamp ? data.closesAt.toDate() : (data.closesAt as Date | null) ?? null,
  active: (data.active as boolean) ?? false,
  updatedBy: (data.updatedBy as string) || '',
  updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
});

export const siteSettingsApi = {
  getSwagStore: async (): Promise<SwagStoreSettings> => {
    const docRef = doc(db, SWAG_STORE_DOC);
    const snap = await getDoc(docRef);
    return snap.exists() ? fromFirestore(snap.data()) : DEFAULT_SWAG_STORE;
  },

  updateSwagStore: async (data: Partial<SwagStoreSettings>): Promise<void> => {
    const docRef = doc(db, SWAG_STORE_DOC);
    const payload: Record<string, unknown> = { ...data, updatedAt: Timestamp.now() };
    // Convert null closesAt explicitly so Firestore stores null
    if (data.closesAt === null) payload.closesAt = null;
    await setDoc(docRef, payload, { merge: true });
  },
};
