// Comments routes — public read, authenticated create/delete.

import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { getRole } from '../middleware/roleCheck';
import {
  createComment,
  deleteComment,
  getCommentsByEventId,
} from '../services/commentService';

export const commentsRouter: Router = Router();

const MAX_COMMENT_LENGTH = 2000;

// GET /comments/:eventId — public, list comments for an event
commentsRouter.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const { eventId } = req.params;
    const comments = await getCommentsByEventId(eventId);
    res.status(200).json({ comments });
  } catch (err) {
    console.error('[GET /comments/:eventId]', err);
    res.status(500).json({ error: 'fetch_failed' });
  }
});

// POST /comments — authenticated, create a comment
commentsRouter.post(
  '/',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const { eventId, content } = req.body;

      if (!eventId || typeof eventId !== 'string') {
        res.status(400).json({ error: 'eventId_required' });
        return;
      }

      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'content_required' });
        return;
      }

      const trimmed = content.trim();
      if (trimmed.length === 0) {
        res.status(400).json({ error: 'content_empty' });
        return;
      }

      if (trimmed.length > MAX_COMMENT_LENGTH) {
        res.status(400).json({ error: 'content_too_long' });
        return;
      }

      const comment = await createComment(userId, {
        eventId,
        content: trimmed,
      });

      res.status(201).json({ comment });
    } catch (err) {
      console.error('[POST /comments]', err);
      res.status(500).json({ error: 'create_failed' });
    }
  },
);

// DELETE /comments/:commentId — authenticated, delete own comment (or admin/moderator)
commentsRouter.delete(
  '/:commentId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!.uid;
      const role = await getRole(userId);
      const { commentId } = req.params;

      const deleted = await deleteComment(commentId, userId, role ?? 'guest');

      if (!deleted) {
        res.status(403).json({ error: 'not_authorized' });
        return;
      }

      res.status(200).json({ success: true });
    } catch (err) {
      console.error('[DELETE /comments/:commentId]', err);
      res.status(500).json({ error: 'delete_failed' });
    }
  },
);