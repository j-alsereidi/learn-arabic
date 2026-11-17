// Sign-in: Firebase Authentication (email and password, or Google in a popup), traded for the server's session
// cookie. Firebase is only used to sign in; from then on the cookie signs every request, for the website and the
// browser extension alike. Without an account you're a guest: data for this browser session only.
import { initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut as firebaseSignOut,
} from 'firebase/auth';

// Public by design: Firebase web config identifies the project, it doesn't grant access
const firebaseConfig = {
  apiKey: 'AIzaSyA8ZUuvQy2ykG_HlapN5CFB2WQ66siOsqQ',
  authDomain: 'flashcard-studio-f54c5.firebaseapp.com',
  projectId: 'flashcard-studio-f54c5',
  appId: '1:612298231558:web:e81ab34afd571160b25887',
};

const API_BASE = process.env.REACT_APP_API_URL || '';
const auth = getAuth(initializeApp(firebaseConfig));

const post = (path, body) => fetch(`${API_BASE}${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
});

// {user: the account or null, guest: whether this is a guest session}
export const currentSession = () => fetch(`${API_BASE}/api/auth/me`).then(r => r.json());
export const currentUser = () => currentSession().then(d => d.user);
export const startGuest = () => post('/api/auth/guest').then(r => r.json());

async function toSession(credential) {
  const res = await post('/api/auth/session', { idToken: await credential.user.getIdToken() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Sign-in failed');
  return data.user;
}

export const signInWithGoogle = async () => toSession(await signInWithPopup(auth, new GoogleAuthProvider()));
export const signInWithEmail = async (email, password, create) =>
  toSession(await (create ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password));
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);

// Firebase's error codes, said plainly; closing the Google popup isn't an error (null)
const AUTH_ERRORS = {
  'auth/invalid-credential': 'Wrong email or password',
  'auth/wrong-password': 'Wrong email or password',
  'auth/user-not-found': 'Wrong email or password',
  'auth/invalid-email': "That email address isn't valid",
  'auth/missing-email': 'Enter your email address',
  'auth/missing-password': 'Enter a password',
  'auth/email-already-in-use': 'There is already an account with this email',
  'auth/weak-password': 'Use at least 6 characters',
  'auth/too-many-requests': 'Too many tries. Try again later',
  'auth/network-request-failed': "Can't reach the sign-in service",
  'auth/popup-closed-by-user': null,
  'auth/cancelled-popup-request': null,
};
export const authError = (e) => (e.code in AUTH_ERRORS ? AUTH_ERRORS[e.code] : e.message || 'Sign-in failed');

export async function signOut() {
  await post('/api/auth/logout');
  await firebaseSignOut(auth).catch(() => {});
}

export const phoneCode = () => post('/api/auth/phone').then(r => r.json());
export const unlinkPhone = () => fetch(`${API_BASE}/api/auth/phone`, { method: 'DELETE' }).then(r => r.json()).then(d => d.user);
