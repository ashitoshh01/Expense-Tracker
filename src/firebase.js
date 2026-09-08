import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  onSnapshot
} from 'firebase/firestore'

// Firebase configuration from .env
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase App
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// Initialize Firestore Database
export const db = getFirestore(app)

// Initialize Analytics if supported
export let analytics = null
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app)
    }
  }).catch(() => {})
}

// Document reference for user's expense tracker data
export const DATA_COLLECTION = 'wallet_data'
export const DATA_DOC = 'current_user'

export const getUserDocRef = () => doc(db, DATA_COLLECTION, DATA_DOC)

/**
 * Diagnostic function to test live Firestore connection
 * @returns {Promise<{ ok: boolean, notCreated?: boolean, exists?: boolean, data?: any, error?: string, consoleUrl?: string }>}
 */
export async function checkFirestoreConnection() {
  try {
    const docRef = getUserDocRef()
    const snap = await getDocFromServer(docRef)
    return {
      ok: true,
      exists: snap.exists(),
      data: snap.exists() ? snap.data() : null,
    }
  } catch (err) {
    const msg = String(err?.message || err)
    const notCreated =
      msg.includes('Cloud Firestore API has not been used') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('not found') ||
      err?.code === 'permission-denied'
    return {
      ok: false,
      notCreated,
      error: msg,
      consoleUrl: `https://console.firebase.google.com/project/${firebaseConfig.projectId || 'expense-b7fcb'}/firestore`,
    }
  }
}

/**
 * Fetch fresh data directly from Cloud Firestore server (bypassing local cache)
 * @returns {Promise<Object|null>}
 */
export async function fetchFreshFromServer() {
  const docRef = getUserDocRef()
  const snap = await getDocFromServer(docRef)
  if (snap.exists()) {
    return snap.data()
  }
  return null
}

/**
 * Subscribe to real-time updates from Cloud Firestore
 * @param {Function} onData Callback when document is updated
 * @param {Function} onError Callback if an error occurs
 * @returns {Function} Unsubscribe function
 */
export function subscribeUserData(onData, onError) {
  const docRef = getUserDocRef()
  return onSnapshot(
    docRef,
    (snapshot) => {
      // Check if snapshot contains data from server or cache
      if (snapshot.exists()) {
        onData(snapshot.data(), snapshot.metadata.fromCache)
      } else {
        onData(null, snapshot.metadata.fromCache)
      }
    },
    (err) => {
      console.warn('Firestore subscription error:', err)
      if (onError) onError(err)
    }
  )
}

/**
 * Force write to Cloud Firestore immediately (no debouncing)
 * @param {Object} data State data to save
 * @returns {Promise<Object>}
 */
export async function forcePushToCloud(data) {
  const docRef = getUserDocRef()
  const payload = {
    balance: Number(data.balance) || 0,
    savings: Number(data.savings) || 0,
    loans: Array.isArray(data.loans) ? data.loans : [],
    transactions: Array.isArray(data.transactions) ? data.transactions : [],
    savingsGoal: Number(data.savingsGoal) || 1000,
    lastSalaryMonth: data.lastSalaryMonth || '',
    updatedAt: new Date().toISOString(),
  }
  await setDoc(docRef, payload, { merge: true })
  return payload
}

// Debounce timer for saving during normal user interactions
let saveTimeout = null

/**
 * Save user data to Cloud Firestore (debounced 300ms)
 * @param {Object} data State data to save
 * @returns {Promise<void>}
 */
export async function saveUserData(data) {
  return new Promise((resolve, reject) => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      try {
        const payload = await forcePushToCloud(data)
        resolve(payload)
      } catch (err) {
        console.error('Firestore save error:', err)
        reject(err)
      }
    }, 300)
  })
}
