import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAnalytics, isSupported } from 'firebase/analytics'
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  enableIndexedDbPersistence
} from 'firebase/firestore'

// Firebase configuration from .env
const firebaseConfig = {
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
  }).catch(() => {
    // Analytics not supported in this environment
  })
}

// Document reference for user's expense tracker data
const DATA_COLLECTION = 'wallet_data'
const DATA_DOC = 'current_user'

const getUserDocRef = () => doc(db, DATA_COLLECTION, DATA_DOC)

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
      if (snapshot.exists()) {
        onData(snapshot.data())
      } else {
        // Document doesn't exist yet in cloud
        onData(null)
      }
    },
    (err) => {
      console.warn('Firestore subscription error:', err)
      if (onError) onError(err)
    }
  )
}

/**
 * Fetch one-time data from Cloud Firestore
 * @returns {Promise<Object|null>}
 */
export async function fetchUserData() {
  try {
    const docRef = getUserDocRef()
    const snapshot = await getDoc(docRef)
    if (snapshot.exists()) {
      return snapshot.data()
    }
    return null
  } catch (err) {
    console.warn('Firestore fetch error:', err)
    return null
  }
}

// Debounce timer for saving to prevent excessive Firestore write bursts
let saveTimeout = null

/**
 * Save user data to Cloud Firestore (with debouncing)
 * @param {Object} data State data to save
 * @returns {Promise<void>}
 */
export async function saveUserData(data) {
  return new Promise((resolve, reject) => {
    if (saveTimeout) clearTimeout(saveTimeout)
    saveTimeout = setTimeout(async () => {
      try {
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
        resolve()
      } catch (err) {
        console.error('Firestore save error:', err)
        reject(err)
      }
    }, 250)
  })
}
