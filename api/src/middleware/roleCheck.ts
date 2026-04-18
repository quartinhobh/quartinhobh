// Role-check middleware factory.
// Reads Firestore /users/{uid} to resolve the role.

import type { NextFunction, Request, Response } from 'express';
import { adminDb } from '../config/firebase';
import type { UserRole } from '../types';

export function requireRole(
  ...roles: readonly UserRole[]
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }
    try {
      const role = await getRole(req.user.uid);
      if (!role || !roles.includes(role)) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: 'role_lookup_failed' });
    }
  };
}

export async function getRole(uid: string): Promise<UserRole | null> {
  const snap = await adminDb.collection('users').doc(uid).get();
  const data = snap.data() as { role?: UserRole } | undefined;
  return data?.role ?? null;
}
