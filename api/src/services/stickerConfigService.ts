import { adminDb } from '../config/firebase';

export interface StickerConfig {
  enabled: boolean;
  maxConcurrent: number;
  spawnMinSeconds: number;
  spawnMaxSeconds: number;
  maxBeforeCooldown: number;
  cooldownHours: number;
  enabledAssets: string[];
  updatedAt: number;
}

const COLLECTION = 'siteSettings';
const DOC_ID = 'stickers';

const ALL_ASSETS = [
  'star-burst.svg',
  'heart.svg',
  'lightning.svg',
  'exclamation.svg',
  'spiral.svg',
  'ladybug.svg',
  'music-note.svg',
  'bee.svg',
  'lollipop.svg',
  'candy.svg',
  'bear.svg',
];

export const DEFAULT_STICKER_CONFIG: StickerConfig = {
  enabled: true,
  maxConcurrent: 2,
  spawnMinSeconds: 60,
  spawnMaxSeconds: 180,
  maxBeforeCooldown: 8,
  cooldownHours: 4,
  enabledAssets: ALL_ASSETS,
  updatedAt: 0,
};

export async function getStickerConfig(): Promise<StickerConfig> {
  const snap = await adminDb.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return DEFAULT_STICKER_CONFIG;
  const data = snap.data() as Partial<StickerConfig>;
  return { ...DEFAULT_STICKER_CONFIG, ...data };
}

export async function updateStickerConfig(
  patch: Partial<Omit<StickerConfig, 'updatedAt'>>,
): Promise<StickerConfig> {
  const current = await getStickerConfig();
  const next: StickerConfig = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await adminDb.collection(COLLECTION).doc(DOC_ID).set(next, { merge: true });
  return next;
}
