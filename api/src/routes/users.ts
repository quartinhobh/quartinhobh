import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { adminDb } from '../config/firebase';
import type { User, UserRole } from '../types';
import { sendEmail, buildRoleInviteEmail, buildRolePromotionEmail } from '../services/emailService';

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
      const prevRole = (snap.data() as User).role;
      await ref.update({ role, updatedAt: Date.now() });

      // Auto-email when promoting to admin or moderator
      if ((role === 'admin' || role === 'moderator') && prevRole !== role) {
        const email = (snap.data() as User).email;
        if (email) {
          const roleName = role === 'admin' ? 'admin' : 'moderador';
          sendEmail(email, `Você agora é ${roleName} no Quartinho BH!`, buildRolePromotionEmail(role)).catch((err) =>
            console.error('[users] role promotion email failed:', err),
          );
        }
      }

      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'update_role_failed' });
    }
  },
);

/** GET /users/invites — list pending role invites (admin only) */
usersRouter.get(
  '/invites',
  requireAuth,
  requireRole('admin'),
  async (_req: Request, res: Response) => {
    try {
      const snap = await adminDb.collection('role_invites').get();
      const invites = snap.docs.map((d) => ({ email: d.id, role: (d.data() as { role: UserRole }).role }));
      res.status(200).json({ invites });
    } catch {
      res.status(500).json({ error: 'list_invites_failed' });
    }
  },
);

/** POST /users/invites — create a role invite by email (admin only) */
usersRouter.post(
  '/invites',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const { email, role } = req.body as { email?: string; role?: string };
    const allowed: UserRole[] = ['user', 'moderator', 'admin'];
    if (!email || !role || !allowed.includes(role as UserRole)) {
      res.status(400).json({ error: 'invalid_email_or_role' });
      return;
    }
    try {
      await adminDb.collection('role_invites').doc(email).set({ role, createdAt: Date.now() });

      // Envia email de convite automaticamente
      const roleName = role === 'admin' ? 'admin' : 'moderador';
      sendEmail(email, `Convite: você é ${roleName} no Quartinho BH`, buildRoleInviteEmail(role)).catch((err) =>
        console.error('[users] invite email failed:', err),
      );

      res.status(201).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'create_invite_failed' });
    }
  },
);

/** DELETE /users/invites/:email — remove a pending invite (admin only) */
usersRouter.delete(
  '/invites/:email',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      await adminDb.collection('role_invites').doc(req.params.email!).delete();
      res.status(204).send();
    } catch {
      res.status(500).json({ error: 'delete_invite_failed' });
    }
  },
);
