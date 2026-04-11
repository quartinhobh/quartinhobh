import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { writeLimiter } from '../middleware/rateLimit';
import {
  getStickerConfig,
  updateStickerConfig,
  type StickerConfig,
} from '../services/stickerConfigService';

export const stickerConfigRouter: Router = Router();

/** GET /sticker-config — public, read by every visitor's spawner. */
stickerConfigRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const config = await getStickerConfig();
    res.status(200).json({ config });
  } catch (err) {
    console.error('[GET /sticker-config]', err);
    res.status(500).json({ error: 'get_sticker_config_failed' });
  }
});

/** PATCH /sticker-config — admin only. */
stickerConfigRouter.patch(
  '/',
  writeLimiter,
  requireAuth,
  requireRole('admin'),
  async (req: Request, res: Response) => {
    const body = req.body as Partial<Omit<StickerConfig, 'updatedAt'>>;
    const patch: Partial<Omit<StickerConfig, 'updatedAt'>> = {};

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== 'boolean') {
        res.status(400).json({ error: 'enabled must be boolean' });
        return;
      }
      patch.enabled = body.enabled;
    }
    const numericFields: (keyof Omit<StickerConfig, 'updatedAt' | 'enabled' | 'enabledAssets'>)[] = [
      'maxConcurrent',
      'spawnMinSeconds',
      'spawnMaxSeconds',
      'maxBeforeCooldown',
      'cooldownHours',
    ];
    for (const f of numericFields) {
      const v = body[f];
      if (v === undefined) continue;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        res.status(400).json({ error: `${f} must be a non-negative number` });
        return;
      }
      patch[f] = v;
    }
    if (
      typeof body.spawnMinSeconds === 'number' &&
      typeof body.spawnMaxSeconds === 'number' &&
      body.spawnMinSeconds > body.spawnMaxSeconds
    ) {
      res.status(400).json({ error: 'spawnMinSeconds must be <= spawnMaxSeconds' });
      return;
    }
    if (body.enabledAssets !== undefined) {
      if (!Array.isArray(body.enabledAssets) || body.enabledAssets.some((a) => typeof a !== 'string')) {
        res.status(400).json({ error: 'enabledAssets must be string[]' });
        return;
      }
      patch.enabledAssets = body.enabledAssets;
    }

    try {
      const config = await updateStickerConfig(patch);
      res.status(200).json({ config });
    } catch (err) {
      console.error('[PATCH /sticker-config]', err);
      res.status(500).json({ error: 'update_sticker_config_failed' });
    }
  },
);
