import { create } from 'zustand';
import type { UserRole } from '@/types';

export interface SessionState {
  sessionId: string | null;
  guestName: string | null;
  firebaseUid: string | null;
  // TODO(P3-H): populate `role` by fetching the user profile after login.
  // For P3-F we expose the field (defaulting to 'guest') so moderation UI
  // can gate on it — the real fetch lands with the admin panel.
  role: UserRole;
  setSession: (s: { sessionId: string; guestName: string }) => void;
  setFirebaseUid: (uid: string | null) => void;
  setRole: (role: UserRole) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  guestName: null,
  firebaseUid: null,
  role: 'guest',
  setSession: ({ sessionId, guestName }) => set({ sessionId, guestName }),
  setFirebaseUid: (firebaseUid) => set({ firebaseUid }),
  setRole: (role) => set({ role }),
  clear: () =>
    set({ sessionId: null, guestName: null, firebaseUid: null, role: 'guest' }),
}));
