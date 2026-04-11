import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { writeLimiter } from '../middleware/rateLimit';
import { adminDb } from '../config/firebase';
import { incrementStat, getUserStats } from '../services/userStatsService';

export const userStatsRouter: Router = Router();

/** POST /user-stats/sticker-click — auth optional. If logged in, +1 to the
 *  caller's stickersClicked. Anon callers are silently ignored (the client
 *  can buffer locally and sync later if we ever decide to). */
userStatsRouter.post(
  '/sticker-click',
  writeLimiter,
  async (req: Request, res: Response) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      res.status(200).json({ ok: true, counted: false });
      return;
    }
    try {
      const { adminAuth } = await import('../config/firebase');
      const decoded = await adminAuth.verifyIdToken(auth.slice(7));
      await incrementStat(decoded.uid, 'stickersClicked');
      res.status(200).json({ ok: true, counted: true });
    } catch {
      res.status(200).json({ ok: true, counted: false });
    }
  },
);

/** POST /user-stats/profile-visit — body: { username }. Auth optional. If
 *  logged in and visiting someone else's profile, +1 to visitor.profilesVisited
 *  AND +1 to owner.profileViewsReceived. Anon callers only bump the owner. */
userStatsRouter.post(
  '/profile-visit',
  writeLimiter,
  async (req: Request, res: Response) => {
    const { username } = req.body as { username?: string };
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'username_required' });
      return;
    }
    try {
      const ownerSnap = await adminDb
        .collection('users')
        .where('username', '==', username)
        .limit(1)
        .get();
      if (ownerSnap.empty) {
        res.status(200).json({ ok: true, counted: false });
        return;
      }
      const ownerId = ownerSnap.docs[0]!.id;

      let visitorId: string | null = null;
      const auth = req.headers.authorization;
      if (auth?.startsWith('Bearer ')) {
        try {
          const { adminAuth } = await import('../config/firebase');
          const decoded = await adminAuth.verifyIdToken(auth.slice(7));
          visitorId = decoded.uid;
        } catch {
          /* invalid token — treat as anon */
        }
      }

      if (visitorId === ownerId) {
        // Self-view doesn't count.
        res.status(200).json({ ok: true, counted: false });
        return;
      }

      await incrementStat(ownerId, 'profileViewsReceived');
      if (visitorId) {
        await incrementStat(visitorId, 'profilesVisited');
      }
      res.status(200).json({ ok: true, counted: true });
    } catch (err) {
      console.error('[POST /user-stats/profile-visit]', err);
      res.status(500).json({ error: 'profile_visit_failed' });
    }
  },
);

/** GET /user-stats/me — authenticated, returns the caller's stats. */
userStatsRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await getUserStats(req.user!.uid);
    res.status(200).json({
      stats: stats ?? {
        userId: req.user!.uid,
        stickersClicked: 0,
        profilesVisited: 0,
        profileViewsReceived: 0,
        updatedAt: 0,
      },
    });
  } catch {
    res.status(500).json({ error: 'get_user_stats_failed' });
  }
});
