import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { adminDb } from '../config/firebase';
import type { User, UserRole } from '../types';

export const usersRouter: Router = Router();

/** GET /users — list all users (admin only) */
usersRouter.get(
  '/',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('users').orderBy('createdAt', 'desc').get();
      const users = snap.docs.map((d) => d.data() as User);
      res.status(200).json({ users });
    } catch {
      res.status(500).json({ error: 'list_users_failed' });
    }
  },
);

/** PUT /users/:id/role — update a user's role (admin only) */
usersRouter.put(
  '/:id/role',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { role } = req.body as { role?: string };
    const allowed: UserRole[] = ['user', 'moderator', 'admin'];
    if (!role || !allowed.includes(role as UserRole)) {
      res.status(400).json({ error: 'invalid_role' });
      return;
    }
    try {
      const ref = adminDb.collection('users').doc(req.params.id!);
      const snap = await ref.get();
      if (!snap.exists) {
        res.status(404).json({ error: 'user_not_found' });
        return;
      }
      await ref.update({ role, updatedAt: Date.now() });
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'update_role_failed' });
    }
  },
);
