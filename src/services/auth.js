/**
 * Firebase Authentication Service for Wallet FIX.
 *
 * Implements strict user isolation via stable Firebase UIDs:
 * 1. Automatic anonymous authentication ensures every device/user has an isolated UID.
 * 2. Optional Google Sign-In allows upgrading/linking or signing into an existing cloud profile.
 * 3. Safe sign-out that leaves local and remote financial data completely intact.
 * 4. Zero shared unauthenticated document access.
 */

import {
  getAuth,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { app } from '../firebase'

export const auth = getAuth(app)

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/**
 * Get current authenticated user or null.
 * @returns {import('firebase/auth').User|null}
 */
export function getCurrentUser() {
  return auth.currentUser
}

/**
 * Get the stable UID of the current user, or 'anonymous_local' if auth has not resolved yet.
 * @returns {string}
 */
export function getCurrentUserId() {
  return auth.currentUser?.uid || 'anonymous_local'
}

/**
 * Initialize authentication session.
 * If no user is signed in, seamlessly sign in anonymously so that
 * the user has an isolated UID immediately.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function initializeAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe()
      if (user) {
        resolve(user)
      } else {
        try {
          const cred = await signInAnonymously(auth)
          resolve(cred.user)
        } catch (err) {
          console.warn('Anonymous sign-in failed, proceeding with local fallback:', err)
          resolve(null)
        }
      }
    })
  })
}

/**
 * Subscribe to authentication state changes.
 * @param {Function} callback (user) => void
 * @returns {Function} Unsubscribe function
 */
export function subscribeAuthState(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user)
  })
}

/**
 * Sign in with Google provider.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (err) {
    console.error('Google Sign-in error:', err)
    throw err
  }
}

/**
 * Sign out safely without deleting financial data.
 * After sign out, signs in anonymously to ensure a fresh clean isolated session.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signOutUser() {
  await fbSignOut(auth)
  const cred = await signInAnonymously(auth)
  return cred.user
}
