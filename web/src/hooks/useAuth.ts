import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth } from '@/services/firebase';
import { fetchCurrentUser, postLinkSession } from '@/services/api';
import { useSessionStore } from '@/store/sessionStore';

export function useAuth() {
  const { sessionId, firebaseUid, setFirebaseUid, setUser: setStoreUser, clear } =
    useSessionStore();
  const [user, setUser] = useState<User | null>(auth.currentUser ?? null);

  // Guard: when afterSignIn is running, onAuthStateChanged must NOT call
  // /auth/me — otherwise it races and overwrites role with 'guest' before
  // postLinkSession has created the user doc.
  const signingIn = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next && !signingIn.current) {
        // Re-hydrate on page refresh (not during active sign-in).
        setFirebaseUid(next.uid);
        try {
          const idToken = await next.getIdToken();
          const me = await fetchCurrentUser(idToken);
          setStoreUser(me);
        } catch {
          // API offline — keep whatever localStorage had.
        }
      }
    });
    return unsub;
  }, [setFirebaseUid, setStoreUser]);

  async function afterSignIn(result: UserCredential): Promise<void> {
    signingIn.current = true;
    try {
      const idToken = await result.user.getIdToken();
      try {
        const linked = await postLinkSession(idToken, sessionId);
        setFirebaseUid(linked.firebaseUid);
      } catch {
        setFirebaseUid(result.user.uid);
      }
      try {
        const me = await fetchCurrentUser(idToken);
        setStoreUser(me);
      } catch {
        // Leave defaults.
      }
    } finally {
      signingIn.current = false;
    }
  }

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    await afterSignIn(result);
  };

  const signInWithApple = async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const result = await signInWithPopup(auth, provider);
    await afterSignIn(result);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await afterSignIn(result);
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await afterSignIn(result);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setFirebaseUid(null);
    clear();
  };

  return {
    user,
    isAuthenticated: firebaseUid !== null || !!user,
    signInWithGoogle,
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };
}
