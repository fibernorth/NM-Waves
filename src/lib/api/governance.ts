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
import type { BoardMeeting, GovernanceDocument } from '@/types/models';

const MEETINGS_COLLECTION = 'boardMeetings';
const GOVERNANCE_COLLECTION = 'governanceDocuments';

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// ============================================
// BOARD MEETINGS
// ============================================

const convertMeeting = (id: string, data: any): BoardMeeting => ({
  id,
  date: data.date?.toDate() || new Date(),
  title: data.title,
  location: data.location,
  attendees: data.attendees || [],
  absentees: data.absentees || [],
  agendaItems: data.agendaItems || [],
  minutesText: data.minutesText || '',
  resolutions: data.resolutions || [],
  nextMeetingDate: data.nextMeetingDate?.toDate(),
  approvedBy: data.approvedBy,
  approvedAt: data.approvedAt?.toDate(),
  status: data.status || 'draft',
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const boardMeetingsApi = {
  getAll: async (): Promise<BoardMeeting[]> => {
    const q = query(collection(db, MEETINGS_COLLECTION), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertMeeting(d.id, d.data()));
  },

  getById: async (id: string): Promise<BoardMeeting | null> => {
    const snap = await getDoc(doc(db, MEETINGS_COLLECTION, id));
    return snap.exists() ? convertMeeting(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<BoardMeeting, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, MEETINGS_COLLECTION), cleanData({
      ...data,
      date: Timestamp.fromDate(data.date),
      nextMeetingDate: data.nextMeetingDate ? Timestamp.fromDate(data.nextMeetingDate) : null,
      approvedAt: data.approvedAt ? Timestamp.fromDate(data.approvedAt) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<BoardMeeting>): Promise<void> => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.date) updateData.date = Timestamp.fromDate(data.date);
    if (data.nextMeetingDate) updateData.nextMeetingDate = Timestamp.fromDate(data.nextMeetingDate);
    if (data.approvedAt) updateData.approvedAt = Timestamp.fromDate(data.approvedAt);
    await updateDoc(doc(db, MEETINGS_COLLECTION, id), cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, MEETINGS_COLLECTION, id));
  },

  approve: async (id: string, approvedBy: string): Promise<void> => {
    await updateDoc(doc(db, MEETINGS_COLLECTION, id), {
      status: 'approved',
      approvedBy,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },
};

// ============================================
// GOVERNANCE DOCUMENTS
// ============================================

const convertGovDoc = (id: string, data: any): GovernanceDocument => ({
  id,
  type: data.type,
  title: data.title,
  description: data.description,
  fileUrl: data.fileUrl,
  fileName: data.fileName,
  version: data.version || '1.0',
  effectiveDate: data.effectiveDate?.toDate() || new Date(),
  reviewDate: data.reviewDate?.toDate(),
  approvedBy: data.approvedBy,
  approvedAt: data.approvedAt?.toDate(),
  status: data.status || 'draft',
  createdBy: data.createdBy,
  createdAt: data.createdAt?.toDate() || new Date(),
  updatedAt: data.updatedAt?.toDate() || new Date(),
});

export const governanceDocsApi = {
  getAll: async (): Promise<GovernanceDocument[]> => {
    const q = query(collection(db, GOVERNANCE_COLLECTION), orderBy('type'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertGovDoc(d.id, d.data()));
  },

  getActive: async (): Promise<GovernanceDocument[]> => {
    const q = query(
      collection(db, GOVERNANCE_COLLECTION),
      where('status', '==', 'active'),
      orderBy('type')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => convertGovDoc(d.id, d.data()));
  },

  getById: async (id: string): Promise<GovernanceDocument | null> => {
    const snap = await getDoc(doc(db, GOVERNANCE_COLLECTION, id));
    return snap.exists() ? convertGovDoc(snap.id, snap.data()) : null;
  },

  create: async (data: Omit<GovernanceDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const docRef = await addDoc(collection(db, GOVERNANCE_COLLECTION), cleanData({
      ...data,
      effectiveDate: Timestamp.fromDate(data.effectiveDate),
      reviewDate: data.reviewDate ? Timestamp.fromDate(data.reviewDate) : null,
      approvedAt: data.approvedAt ? Timestamp.fromDate(data.approvedAt) : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }));
    return docRef.id;
  },

  update: async (id: string, data: Partial<GovernanceDocument>): Promise<void> => {
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    if (data.effectiveDate) updateData.effectiveDate = Timestamp.fromDate(data.effectiveDate);
    if (data.reviewDate) updateData.reviewDate = Timestamp.fromDate(data.reviewDate);
    if (data.approvedAt) updateData.approvedAt = Timestamp.fromDate(data.approvedAt);
    await updateDoc(doc(db, GOVERNANCE_COLLECTION, id), cleanData(updateData));
  },

  delete: async (id: string): Promise<void> => {
    await deleteDoc(doc(db, GOVERNANCE_COLLECTION, id));
  },
};
