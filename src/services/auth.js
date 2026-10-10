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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  linkWithPopup,
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
 * Resolves current user if already signed in, or null if unauthenticated.
 * Does not force anonymous login, allowing the app to present the Auth screen.
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function initializeAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe()
      resolve(user || null)
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
 * Sign in as a Guest (anonymous session).
 * Creates an isolated private UID immediately without requiring credentials.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInAsGuest() {
  try {
    const cred = await signInAnonymously(auth)
    return cred.user
  } catch (err) {
    console.error('Guest sign-in error:', err)
    throw err
  }
}

/**
 * Sign in with email and password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInWithEmail(email, password) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
    return cred.user
  } catch (err) {
    console.error('Email sign-in error:', err)
    throw err
  }
}

/**
 * Create a new account with email, password, and user display name.
 * @param {string} email
 * @param {string} password
 * @param {string} [displayName]
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signUpWithEmail(email, password, displayName = '') {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
    if (displayName && displayName.trim()) {
      try {
        await updateProfile(cred.user, { displayName: displayName.trim() })
      } catch (profileErr) {
        console.warn('Profile name update notice:', profileErr)
      }
    }
    return cred.user
  } catch (err) {
    console.error('Email sign-up error:', err)
    throw err
  }
}

/**
 * Update authenticated user's display name.
 * @param {string} displayName
 * @returns {Promise<import('firebase/auth').User|null>}
 */
export async function updateUserProfileName(displayName) {
  try {
    if (auth.currentUser && displayName && displayName.trim()) {
      await updateProfile(auth.currentUser, { displayName: displayName.trim() })
      return auth.currentUser
    }
  } catch (err) {
    console.error('Update display name error:', err)
    throw err
  }
  return auth.currentUser
}

/**
 * Sign in with Google provider.
 * If currently anonymous, links account to Google to preserve data under the exact same UID.
 * Falls back to standard signInWithPopup if already linked or credential belongs to another account.
 * @returns {Promise<import('firebase/auth').User>}
 */
export async function signInWithGoogle() {
  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      try {
        const result = await linkWithPopup(auth.currentUser, googleProvider)
        return result.user
      } catch (linkErr) {
        if (
          linkErr.code === 'auth/credential-already-in-use' ||
          linkErr.code === 'auth/email-already-in-use' ||
          linkErr.code === 'auth/provider-already-linked'
        ) {
          const result = await signInWithPopup(auth, googleProvider)
          return result.user
        }
        throw linkErr
      }
    }
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (err) {
    console.error('Google Sign-in error:', err)
    throw err
  }
}

/**
 * Sign out safely without deleting financial data.
 * Returns null to bring user back to the Auth screen.
 * @returns {Promise<null>}
 */
export async function signOutUser() {
  await fbSignOut(auth)
  return null
}
