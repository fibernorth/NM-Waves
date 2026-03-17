import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { VolunteerHourLog, BackgroundCheck, Form990Data } from '@/types/models';

const VOLUNTEER_HOURS_COLLECTION = 'volunteerHours';
const BACKGROUND_CHECKS_COLLECTION = 'backgroundChecks';
const FORM990_COLLECTION = 'form990Data';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// ============================================
// VOLUNTEER HOURS
// ============================================

const convertHourLog = (id: string, data: any): VolunteerHourLog => ({
  id,
  volunteerId: data.volunteerId,
  volunteerName: data.volunteerName,
  date: data.date?.toDate() || new Date(),
  hours: data.hours || 0,
  activity: data.activity,
  eventId: data.eventId,
  eventTitle: data.eventTitle,
  teamId: data.teamId,
  season: data.season,
  verifiedBy: data.verifiedBy,
  verifiedAt: data.verifiedAt?.toDate(),
  notes: data.notes,
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
});

export const volunteerHoursApi = {
  getAll: async (): Promise<VolunteerHourLog[]> => {
    const q = query(collection(db, VOLUNTEER_HOURS_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertHourLog(d.id, d.data()));
  },

  getBySeason: async (season: string): Promise<VolunteerHourLog[]> => {
    const q = query(
      collection(db, VOLUNTEER_HOURS_COLLECTION),
      where('season', '==', season),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertHourLog(d.id, d.data()));
  },

  getByVolunteer: async (volunteerName: string): Promise<VolunteerHourLog[]> => {
    const q = query(
      collection(db, VOLUNTEER_HOURS_COLLECTION),
      where('volunteerName', '==', volunteerName),
      orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertHourLog(d.id, d.data()));
  },

  create: async (data: Omit<VolunteerHourLog, 'id' | 'createdAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, VOLUNTEER_HOURS_COLLECTION), cleanData({
      ...data,
      date: Timestamp.fromDate(data.date),
      verifiedAt: data.verifiedAt ? Timestamp.fromDate(data.verifiedAt) : null,
      createdAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<VolunteerHourLog>): Promise<void> => {
    const updateData: any = { ...data };
    if (data.date) updateData.date = Timestamp.fromDate(data.date);
    if (data.verifiedAt) updateData.verifiedAt = Timestamp.fromDate(data.verifiedAt);
    await updateDoc(doc(db, VOLUNTEER_HOURS_COLLECTION, id), updateData);
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, VOLUNTEER_HOURS_COLLECTION, id));
  },

  verify: async (id: string, verifiedBy: string): Promise<void> => {
    await updateDoc(doc(db, VOLUNTEER_HOURS_COLLECTION, id), {
      verifiedBy,
      verifiedAt: Timestamp.now(),
    });
  },

  /**
   * Get summary stats for a season.
   */
  getSeasonSummary: async (season: string): Promise<{
    totalHours: number;
    uniqueVolunteers: number;
    logCount: number;
  }> => {
    const logs = await volunteerHoursApi.getBySeason(season);
    const uniqueNames = new Set(logs.map(l => l.volunteerName));
    return {
      totalHours: logs.reduce((s, l) => s + l.hours, 0),
      uniqueVolunteers: uniqueNames.size,
      logCount: logs.length,
    };
  },
};

// ============================================
// BACKGROUND CHECKS
// ============================================

const convertBgCheck = (id: string, data: any): BackgroundCheck => ({
  id,
  personName: data.personName,
  personEmail: data.personEmail,
  role: data.role,
  provider: data.provider,
  submittedDate: data.submittedDate?.toDate() || new Date(),
  completedDate: data.completedDate?.toDate(),
  expirationDate: data.expirationDate?.toDate(),
  status: data.status || 'pending',
  notes: data.notes,
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const backgroundChecksApi = {
  getAll: async (): Promise<BackgroundCheck[]> => {
    const q = query(collection(db, BACKGROUND_CHECKS_COLLECTION), orderBy('personName'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertBgCheck(d.id, d.data()));
  },

  getByStatus: async (status: string): Promise<BackgroundCheck[]> => {
    const q = query(
      collection(db, BACKGROUND_CHECKS_COLLECTION),
      where('status', '==', status),
      orderBy('personName')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertBgCheck(d.id, d.data()));
  },

  getById: async (id: string): Promise<BackgroundCheck | null> => {
    const snap = await getDoc(doc(db, BACKGROUND_CHECKS_COLLECTION, id));
    return snap.exists() ? convertBgCheck(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<BackgroundCheck, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, BACKGROUND_CHECKS_COLLECTION), cleanData({
      ...data,
      submittedDate: Timestamp.fromDate(data.submittedDate),
      completedDate: data.completedDate ? Timestamp.fromDate(data.completedDate) : null,
      expirationDate: data.expirationDate ? Timestamp.fromDate(data.expirationDate) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<BackgroundCheck>): Promise<void> => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.submittedDate) updateData.submittedDate = Timestamp.fromDate(data.submittedDate);
    if (data.completedDate) updateData.completedDate = Timestamp.fromDate(data.completedDate);
    if (data.expirationDate) updateData.expirationDate = Timestamp.fromDate(data.expirationDate);
    await updateDoc(doc(db, BACKGROUND_CHECKS_COLLECTION, id), updateData);
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, BACKGROUND_CHECKS_COLLECTION, id));
  },
};

// ============================================
// FORM 990 DATA
// ============================================

const convertForm990 = (id: string, data: any): Form990Data => ({
  id,
  taxYear: data.taxYear,
  formType: data.formType,
  orgName: data.orgName,
  orgEIN: data.orgEIN,
  orgAddress: data.orgAddress,
  orgPhone: data.orgPhone,
  orgWebsite: data.orgWebsite,
  yearFormed: data.yearFormed,
  stateOfIncorporation: data.stateOfIncorporation,
  grossReceipts: data.grossReceipts || 0,
  totalRevenue: data.totalRevenue || 0,
  totalExpenses: data.totalExpenses || 0,
  netAssets: data.netAssets || 0,
  totalAssets: data.totalAssets || 0,
  totalLiabilities: data.totalLiabilities || 0,
  missionStatement: data.missionStatement,
  programAccomplishments: data.programAccomplishments,
  numberOfVolunteers: data.numberOfVolunteers,
  numberOfEmployees: data.numberOfEmployees,
  officers: data.officers || [],
  status: data.status || 'draft',
  filedDate: data.filedDate?.toDate(),
  notes: data.notes,
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const form990Api = {
  getAll: async (): Promise<Form990Data[]> => {
    const q = query(collection(db, FORM990_COLLECTION), orderBy('taxYear', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertForm990(d.id, d.data()));
  },

  getByYear: async (taxYear: number): Promise<Form990Data | null> => {
    const q = query(
      collection(db, FORM990_COLLECTION),
      where('taxYear', '==', taxYear)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return convertForm990(d.id, d.data());
  },

  getById: async (id: string): Promise<Form990Data | null> => {
    const snap = await getDoc(doc(db, FORM990_COLLECTION, id));
    return snap.exists() ? convertForm990(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<Form990Data, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, FORM990_COLLECTION), cleanData({
      ...data,
      filedDate: data.filedDate ? Timestamp.fromDate(data.filedDate) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<Form990Data>): Promise<void> => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.filedDate) updateData.filedDate = Timestamp.fromDate(data.filedDate);
    await updateDoc(doc(db, FORM990_COLLECTION, id), updateData);
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, FORM990_COLLECTION, id));
  },
};
