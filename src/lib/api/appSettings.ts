import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface IntegrationSettings {
  googleDrive?: {
    enabled: boolean;
    folderId: string;
  };
}

export interface OrgSettings {
  orgName: string;
  tagline: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  ein: string;
  logoUrl: string;
  websiteUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface NotificationSettings {
  sendPaymentReceipts: boolean;
  sendInvoiceEmails: boolean;
  sendAnnouncementEmails: boolean;
  sendReminderEmails: boolean;
  reminderDaysBefore: number;
  emailFromName: string;
  emailReplyTo: string;
}

export interface SeasonSettings {
  currentSeason: string;
  seasons: string[];
}

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

const INTEGRATIONS_DOC = 'appSettings/integrations';
const ORG_DOC = 'appSettings/organization';
const NOTIFICATIONS_DOC = 'appSettings/notifications';
const SEASON_DOC = 'appSettings/season';

const DEFAULT_ORG: OrgSettings = {
  orgName: 'Northern Michigan Waves',
  tagline: 'Work as a team, Win as a team, Better every time',
  email: 'tcwavessoftball@gmail.com',
  phone: '',
  address: '555 S Rusch Rd',
  city: 'Traverse City',
  state: 'MI',
  zip: '49696',
  ein: '',
  logoUrl: '/images/logo.png',
  websiteUrl: '',
  primaryColor: '#001f5b',
  secondaryColor: '#9bcbeb',
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  sendPaymentReceipts: true,
  sendInvoiceEmails: true,
  sendAnnouncementEmails: false,
  sendReminderEmails: false,
  reminderDaysBefore: 7,
  emailFromName: 'Northern Michigan Waves',
  emailReplyTo: 'tcwavessoftball@gmail.com',
};

export const appSettingsApi = {
  getIntegrations: async (): Promise<IntegrationSettings> => {
    const docRef = doc(db, INTEGRATIONS_DOC);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as IntegrationSettings) : {};
  },

  updateIntegrations: async (data: IntegrationSettings): Promise<void> => {
    const docRef = doc(db, INTEGRATIONS_DOC);
    await setDoc(docRef, cleanData(data as Record<string, unknown>), { merge: true });
  },

  getOrg: async (): Promise<OrgSettings> => {
    const docRef = doc(db, ORG_DOC);
    const snap = await getDoc(docRef);
    return snap.exists() ? { ...DEFAULT_ORG, ...(snap.data() as Partial<OrgSettings>) } : DEFAULT_ORG;
  },

  updateOrg: async (data: Partial<OrgSettings>): Promise<void> => {
    const docRef = doc(db, ORG_DOC);
    await setDoc(docRef, cleanData(data as Record<string, unknown>), { merge: true });
  },

  getNotifications: async (): Promise<NotificationSettings> => {
    const docRef = doc(db, NOTIFICATIONS_DOC);
    const snap = await getDoc(docRef);
    return snap.exists()
      ? { ...DEFAULT_NOTIFICATIONS, ...(snap.data() as Partial<NotificationSettings>) }
      : DEFAULT_NOTIFICATIONS;
  },

  updateNotifications: async (data: Partial<NotificationSettings>): Promise<void> => {
    const docRef = doc(db, NOTIFICATIONS_DOC);
    await setDoc(docRef, cleanData(data as Record<string, unknown>), { merge: true });
  },

  getSeason: async (): Promise<SeasonSettings> => {
    const docRef = doc(db, SEASON_DOC);
    const snap = await getDoc(docRef);
    const defaults: SeasonSettings = { currentSeason: 'Spring 2026', seasons: ['Spring 2026'] };
    return snap.exists() ? { ...defaults, ...(snap.data() as Partial<SeasonSettings>) } : defaults;
  },

  updateSeason: async (data: Partial<SeasonSettings>): Promise<void> => {
    const docRef = doc(db, SEASON_DOC);
    await setDoc(docRef, cleanData(data as Record<string, unknown>), { merge: true });
  },
};
