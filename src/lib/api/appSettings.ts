import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface IntegrationSettings {
  googleDrive?: {
    enabled: boolean;
    folderId: string;
  };
}

const INTEGRATIONS_DOC = 'appSettings/integrations';

export const appSettingsApi = {
  getIntegrations: async (): Promise<IntegrationSettings> => {
    const docRef = doc(db, INTEGRATIONS_DOC);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as IntegrationSettings) : {};
  },

  updateIntegrations: async (data: IntegrationSettings): Promise<void> => {
    const docRef = doc(db, INTEGRATIONS_DOC);
    await setDoc(docRef, data, { merge: true });
  },
};
