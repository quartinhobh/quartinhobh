// RSVP routes — nested under /events/:eventId/rsvp.
// Public reads, auth writes, admin management.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  getRsvpSummary,
  getUserRsvp,
  submitRsvp,
  cancelRsvp,
  updatePlusOne,
  getAdminList,
  approveOrReject,
  exportCsv,
} from '../services/rsvpService';

export const rsvpRouter: Router = Router({ mergeParams: true });

// GET /events/:eventId/rsvp — public summary (counts + avatars)
rsvpRouter.get('/', async (req: Request, res: Response) => {
  try {
    const summary = await getRsvpSummary(req.params.eventId!);
    res.status(200).json(summary);
  } catch {
    res.status(500).json({ error: 'rsvp_summary_failed' });
  }
});

// GET /events/:eventId/rsvp/user — current user's RSVP status
rsvpRouter.get('/user', requireAuth, async (req: Request, res: Response) => {
  try {
    const entry = await getUserRsvp(req.params.eventId!, req.user!.uid);
    res.status(200).json({ entry });
  } catch {
    res.status(500).json({ error: 'rsvp_user_failed' });
  }
});

// POST /events/:eventId/rsvp — submit RSVP
rsvpRouter.post(
  '/',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { plusOne?: boolean; plusOneName?: string } | undefined;
      const result = await submitRsvp(req.params.eventId!, req.user!.uid, {
        plusOne: body?.plusOne,
        plusOneName: body?.plusOneName,
      });
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'submit_failed';
      const status = ['rsvp_disabled', 'rsvp_closed', 'already_rsvped', 'event_full'].includes(msg) ? 400 : 500;
      res.status(status).json({ error: msg });
    }
  },
);

// DELETE /events/:eventId/rsvp — cancel RSVP
rsvpRouter.delete(
  '/',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const result = await cancelRsvp(req.params.eventId!, req.user!.uid);
      res.status(200).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'cancel_failed';
      res.status(msg === 'not_rsvped' ? 400 : 500).json({ error: msg });
    }
  },
);

// PUT /events/:eventId/rsvp/plus-one — update +1
rsvpRouter.put(
  '/plus-one',
  writeLimiter,
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { plusOne?: boolean; plusOneName?: string } | undefined;
      const entry = await updatePlusOne(
        req.params.eventId!,
        req.user!.uid,
        !!body?.plusOne,
        body?.plusOneName ?? null,
      );
      res.status(200).json({ entry });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'update_failed';
      res.status(msg === 'event_full' ? 400 : 500).json({ error: msg });
    }
  },
);

// ── Admin endpoints ─────────────────────────────────────────────────

// GET /events/:eventId/rsvp/admin — full list with user details
rsvpRouter.get(
  '/admin',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const entries = await getAdminList(req.params.eventId!);
      res.status(200).json({ entries });
    } catch {
      res.status(500).json({ error: 'admin_list_failed' });
    }
  },
);

// PUT /events/:eventId/rsvp/admin/:userId — approve/reject
rsvpRouter.put(
  '/admin/:userId',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const body = req.body as { status?: string } | undefined;
      const newStatus = body?.status;
      if (newStatus !== 'confirmed' && newStatus !== 'rejected') {
        res.status(400).json({ error: 'invalid_status' });
        return;
      }
      const entry = await approveOrReject(req.params.eventId!, req.params.userId!, newStatus);
      res.status(200).json({ entry });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'approve_failed';
      res.status(500).json({ error: msg });
    }
  },
);

// GET /events/:eventId/rsvp/admin/export — CSV download
rsvpRouter.get(
  '/admin/export',
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    try {
      const entries = await getAdminList(req.params.eventId!);
      const csv = exportCsv(entries);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rsvp-${req.params.eventId}.csv"`);
      res.status(200).send(csv);
    } catch {
      res.status(500).json({ error: 'export_failed' });
    }
  },
);
