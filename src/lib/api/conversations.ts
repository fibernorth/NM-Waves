import {
  collection,
  doc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Conversation, Message } from '@/types/models';

const COLLECTION = 'conversations';

const convertConversation = (id: string, data: any): Conversation => ({
  id,
  type: data.type,
  teamId: data.teamId ?? null,
  teamName: data.teamName || '',
  participantIds: data.participantIds || [],
  lastMessage: data.lastMessage || '',
  lastMessageAt: data.lastMessageAt?.toDate() || new Date(),
});

const convertMessage = (id: string, data: any): Message => ({
  id,
  senderId: data.senderId,
  senderName: data.senderName || '',
  text: data.text,
  sentAt: data.sentAt?.toDate() || new Date(),
});

export const conversationsApi = {
  getAll: async (): Promise<Conversation[]> => {
    const q = query(
      collection(db, COLLECTION),
      orderBy('lastMessageAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertConversation(d.id, d.data()));
  },

  getByTeam: async (teamId: string): Promise<Conversation[]> => {
    const q = query(
      collection(db, COLLECTION),
      where('teamId', '==', teamId),
      orderBy('lastMessageAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertConversation(d.id, d.data()));
  },

  create: async (
    data: Omit<Conversation, 'id' | 'lastMessage' | 'lastMessageAt'>
  ): Promise<string> => {
    const docRef = await addDoc(collection(db, COLLECTION), {
      ...data,
      lastMessage: '',
      lastMessageAt: Timestamp.now(),
    });
    return docRef.id;
  },

  getMessages: async (conversationId: string): Promise<Message[]> => {
    const q = query(
      collection(db, COLLECTION, conversationId, 'messages'),
      orderBy('sentAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => convertMessage(d.id, d.data()));
  },

  sendMessage: async (
    conversationId: string,
    message: Omit<Message, 'id' | 'sentAt'>
  ): Promise<string> => {
    const messagesRef = collection(
      db,
      COLLECTION,
      conversationId,
      'messages'
    );
    const docRef = await addDoc(messagesRef, {
      ...message,
      sentAt: Timestamp.now(),
    });

    // Update the conversation's lastMessage and lastMessageAt
    const convRef = doc(db, COLLECTION, conversationId);
    await updateDoc(convRef, {
      lastMessage: message.text,
      lastMessageAt: Timestamp.now(),
    });

    return docRef.id;
  },

  onMessagesSnapshot: (
    conversationId: string,
    callback: (messages: Message[]) => void
  ) => {
    const q = query(
      collection(db, COLLECTION, conversationId, 'messages'),
      orderBy('sentAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map((d) =>
        convertMessage(d.id, d.data())
      );
      callback(messages);
    });
    return unsubscribe;
  },
};
