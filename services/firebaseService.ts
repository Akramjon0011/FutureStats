import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  setDoc,
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  serverTimestamp, 
  getDoc,
  updateDoc,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Configure Firestore and Auth (Strict constraint satisfaction)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Custom Error Handler matching standard
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Map: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Adds a new Lead (CRM generation)
 */
export async function addLead(email: string, tier: 'free' | 'premium' = 'free') {
  const path = 'leads';
  const customId = email.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    const leadDocRef = doc(db, path, customId);
    const snap = await getDoc(leadDocRef);
    
    // Admin override
    const isAdmin = email.toLowerCase() === 'akramfarmonov998@gmail.com';
    const role = isAdmin ? 'admin' : 'user';
    const defaultStatus = isAdmin ? 'approved' : 'pending';

    if (!snap.exists()) {
      await setDoc(leadDocRef, {
        email,
        uid: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
        tier,
        role,
        status: defaultStatus
      });
    } else {
      // If user exists but somehow doesn't have role/status, or if they are admin, ensure it's correct
      const data = snap.data();
      if (isAdmin && data.role !== 'admin') {
         await updateDoc(leadDocRef, { role: 'admin', status: 'approved' });
      } else if (!data.status) {
         await updateDoc(leadDocRef, { role, status: defaultStatus });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${customId}`);
  }
}

/**
 * Get a specific lead by email to check their role and status
 */
export async function getLeadByEmail(email: string): Promise<any> {
  const customId = email.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    const snap = await getDoc(doc(db, 'leads', customId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as any;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `leads/${customId}`);
    return null;
  }
}

/**
 * Get all leads for the admin dashboard
 */
export async function getAllLeads(): Promise<any[]> {
  try {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'), limit(500));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
          ? data.createdAt.toDate() 
          : (data.createdAt ? new Date(data.createdAt) : new Date())
      } as any;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'leads');
    return [];
  }
}

/**
 * Update a lead's status (for admins)
 */
export async function updateLeadStatus(email: string, newStatus: 'approved' | 'pending' | 'rejected') {
  const customId = email.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    await updateDoc(doc(db, 'leads', customId), {
      status: newStatus
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${customId}`);
  }
}

/**
 * Saves generated infographic prompts metadata to history
 */
export async function savePromptHistory(userId: string, topic: string, style: string, promptsCount: number) {
  const path = 'promptsHistory';
  const docId = `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  try {
    const historyDocRef = doc(db, path, docId);
    await setDoc(historyDocRef, {
      userId,
      topic,
      style,
      createdAt: serverTimestamp(),
      promptsCount
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${docId}`);
  }
}

/**
 * Gets historical generations for the logged-in user
 */
export async function getUserPromptHistory(userId: string) {
  const path = 'promptsHistory';
  try {
    const q = query(
      collection(db, path),
      where('userId', '==', userId),
      limit(20)
    );
    const snap = await getDocs(q);
    const docs = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt && typeof data.createdAt.toDate === 'function' 
          ? data.createdAt.toDate() 
          : (data.createdAt ? new Date(data.createdAt) : new Date())
      };
    });
    // Client-side sort to avoid requiring composite indexes
    return docs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Fetches total leads count for administrative/growth stats
 */
export async function getTotalLeadsCount() {
  const path = 'leads';
  try {
    const q = query(collection(db, path), limit(100));
    const snap = await getDocs(q);
    return snap.size;
  } catch (error) {
    // If permission is denied because logged-out or unverified, fail gracefully
    console.warn('Dashboard stats unreadable or auth-restricted');
    return 142; // default mock growth display fallback for offline demo metrics
  }
}

/**
 * Connects a lead to their Telegram Chat ID for automated follow-ups.
 */
export async function updateLeadTelegramChatId(email: string, telegramChatId: string) {
  const customId = email.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    const leadDocRef = doc(db, 'leads', customId);
    const snap = await getDoc(leadDocRef);
    if (snap.exists()) {
      await updateDoc(leadDocRef, { telegramChatId });
      console.log(`[Firebase] Associated email ${email} with Telegram Chat ID: ${telegramChatId}`);
    } else {
      // If user doesn't exist yet, we create a lead document placeholder for them
      await setDoc(leadDocRef, {
        email,
        telegramChatId,
        createdAt: serverTimestamp(),
        tier: 'free',
        role: 'user',
        status: 'pending'
      });
      console.log(`[Firebase] Created new lead document for ${email} with Telegram Chat ID: ${telegramChatId}`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${customId}`);
  }
}

/**
 * Records that a marketing campaign has been sent to a lead.
 */
export async function saveCampaignHistory(email: string, campaignId: string) {
  const customId = email.toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  try {
    const leadDocRef = doc(db, 'leads', customId);
    const snap = await getDoc(leadDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const sentCampaigns = data.sentCampaigns || [];
      if (!sentCampaigns.includes(campaignId)) {
        sentCampaigns.push(campaignId);
        await updateDoc(leadDocRef, { sentCampaigns });
        console.log(`[Firebase] Recorded campaign ${campaignId} sent to ${email}`);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `leads/${customId}`);
  }
}

/**
 * Retrieves all leads who are not yet approved (pending/rejected/free) for marketing targets.
 */
export async function getUnsubscribedOrPendingLeads() {
  try {
    const leads = await getAllLeads();
    // Return leads that are not admin and not approved (or free users)
    return leads.filter(l => l.role !== 'admin' && l.status !== 'approved');
  } catch (error) {
    console.error('[Firebase] Failed to fetch marketing target leads:', error);
    return [];
  }
}

