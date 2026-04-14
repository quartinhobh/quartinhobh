// Extra seed — creates additional demo data for development.
//
// Creates: extra users, extra events, RSVPs, products (lojinha), links, banners.
//
// Usage (from repo root):
//   bun run seed-extra

import { adminAuth, adminDb } from '../src/config/firebase';
import type {
  User,
  UserRole,
  Event,
  EventStatus,
  RsvpDoc,
  RsvpEntry,
  Product,
  LinkTreeItem,
  Banner,
  BannerRoute,
  EventExtras,
} from '../src/types';
import { fetchAlbum } from '../src/services/musicbrainzService';

const SAMPLES = {
  users: [
    { email: 'moderator@test.com', password: 'test12345678', name: 'Moderador Teste', role: 'moderator' as UserRole },
    { email: 'user@test.com', password: 'test12345678', name: 'Usuário Teste', role: 'user' as UserRole },
    { email: 'guest@test.com', password: 'test12345678', name: 'Convidado Teste', role: 'guest' as UserRole },
  ],
  events: [],
  products: [
    { emoji: '🍺', name: 'Cerveja Quartinho', description: 'Lata 350ml', price: 1000 },
    { emoji: '🥤', name: 'Refrigerante', description: 'Lata 350ml', price: 500 },
    { emoji: '🍕', name: 'Pizza Slice', description: 'Uma fatia', price: 1500 },
    { emoji: '🎁', name: 'Camiseta Quartinho', description: 'Tamanho único', price: 5000 },
  ],
  links: [
    { emoji: '📷', title: 'Instagram', url: 'https://instagram.com/quartinhobh' },
    { emoji: '🎵', title: 'Spotify', url: 'https://spotify.com' },
    { emoji: '🐦', title: 'Twitter', url: 'https://twitter.com' },
    { emoji: '📧', title: 'Contato', url: 'mailto:contato@quartinho.com' },
  ],
  banners: [
    {
      imageUrl: 'https://picsum.photos/800/200?random=1',
      altText: 'Banner teste 1',
      routes: ['home' as BannerRoute, 'profile' as BannerRoute],
      link: 'https://example.com/banner1',
    },
    {
      imageUrl: 'https://picsum.photos/800/200?random=2',
      altText: 'Banner lojinha',
      routes: ['lojinha' as BannerRoute],
      link: null,
    },
  ],
};

async function ensureExtraUser(
  email: string,
  password: string,
  displayName: string,
  role: UserRole,
): Promise<string> {
  try {
    const existing = await adminAuth.getUserByEmail(email);
    const ref = adminDb.collection('users').doc(existing.uid);
    await ref.update({ role, updatedAt: Date.now() });
    console.log(`[seed-extra] user ${email} updated to role=${role}`);
    return existing.uid;
  } catch {
    // not found — create
  }
  const created = await adminAuth.createUser({
    email,
    password,
    displayName,
    emailVerified: true,
  });
  await adminDb.collection('users').doc(created.uid).set({
    id: created.uid,
    email,
    displayName,
    username: null,
    role,
    linkedSessionId: null,
    avatarUrl: null,
    bio: null,
    socialLinks: [],
    favoriteAlbums: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  console.log(`[seed-extra] created user ${email} role=${role}`);
  return created.uid;
}

async function fetchAlbumSnapshot(mbid: string): Promise<Event['album']> {
  try {
    const mb = await fetchAlbum(mbid);
    return {
      albumTitle: mb.title,
      artistCredit: mb.artistCredit,
      coverUrl: `https://coverartarchive.org/release/${mb.id}/front-250`,
      coverBlurDataUrl: null,
      tracks: mb.tracks,
    };
  } catch (err) {
    console.log(`[seed-extra] MB fetch failed for ${mbid}: ${(err as Error).message}`);
    return null;
  }
}

async function ensureExtraEvent(
  id: string,
  mbAlbumId: string,
  title: string,
  dateOffset: number,
  status: EventStatus,
  location: string,
  extras: EventExtras,
  adminUid: string,
): Promise<void> {
  const ref = adminDb.collection('events').doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[seed-extra] event ${id} already exists`);
    return;
  }

  const date = new Date();
  date.setDate(date.getDate() + dateOffset);
  const dateStr = date.toISOString().slice(0, 10);

  const album = await fetchAlbumSnapshot(mbAlbumId);
  const now = Date.now();

  const event: Event = {
    id,
    mbAlbumId,
    title,
    date: dateStr,
    startTime: '20:00',
    endTime: '23:00',
    location,
    status,
    album,
    extras,
    spotifyPlaylistUrl: null,
    rsvp: {
      enabled: true,
      capacity: 20,
      waitlistEnabled: true,
      plusOneAllowed: false,
      approvalMode: 'auto',
      opensAt: null,
      closesAt: null,
    },
    createdBy: adminUid,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(event);
  console.log(`[seed-extra] created event ${id} (${status})`);
}

async function addRsvps(eventId: string, adminUid: string): Promise<void> {
  const ref = adminDb.collection('events').doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`[seed-extra] event ${eventId} not found, skipping RSVPs`);
    return;
  }

  const rsvpEntries: Record<string, RsvpEntry> = {
    [adminUid]: {
      status: 'confirmed',
      plusOne: false,
      plusOneName: null,
      email: 'admin@test.com',
      displayName: 'Quartinho Admin',
      authMode: 'firebase',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };

  const rsvpDoc: RsvpDoc = {
    entries: rsvpEntries,
    confirmedCount: 1,
    waitlistCount: 0,
    updatedAt: Date.now(),
  };

  await ref.update({ rsvp: rsvpDoc });
  console.log(`[seed-extra] added RSVP for event ${eventId}`);
}

async function ensureProduct(
  emoji: string,
  name: string,
  description: string,
  price: number,
  sortOrder: number,
): Promise<void> {
  const ref = adminDb.collection('products').doc(`prod-${sortOrder}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[seed-extra] product ${name} already exists`);
    return;
  }

  const now = Date.now();
  const product: Product = {
    id: `prod-${sortOrder}`,
    emoji,
    name,
    description,
    price,
    imageUrl: null,
    active: true,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(product);
  console.log(`[seed-extra] created product ${name}`);
}

async function ensureLink(
  emoji: string,
  title: string,
  url: string,
  sortOrder: number,
): Promise<void> {
  const ref = adminDb.collection('linktree').doc(`link-${sortOrder}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[seed-extra] link ${title} already exists`);
    return;
  }

  const now = Date.now();
  const link: LinkTreeItem = {
    id: `link-${sortOrder}`,
    title,
    url,
    emoji,
    sortOrder,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(link);
  console.log(`[seed-extra] created link ${title}`);
}

async function ensureBanner(
  imageUrl: string,
  altText: string,
  routes: BannerRoute[],
  link: string | null,
  sortOrder: number,
): Promise<void> {
  const ref = adminDb.collection('banners').doc(`banner-${sortOrder}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`[seed-extra] banner ${altText} already exists`);
    return;
  }

  const now = Date.now();
  const banner: Banner = {
    id: `banner-${sortOrder}`,
    imageUrl,
    link,
    altText,
    isActive: true,
    routes,
    autoDismissSeconds: null,
    reappearAfterDismissMs: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await ref.set(banner);
  console.log(`[seed-extra] created banner ${altText}`);
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error(
      '[seed-extra] refusing to run without FIRESTORE_EMULATOR_HOST. This script is dev-only.',
    );
  }

  console.log('[seed-extra] starting extra seed...');

  // Get admin UID for event creation
  let adminUid = '';
  try {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@test.com';
    const adminUser = await adminAuth.getUserByEmail(adminEmail);
    adminUid = adminUser.uid;
  } catch {
    console.log('[seed-extra] admin user not found, using placeholder');
    adminUid = 'admin-placeholder';
  }

  // Create extra users
  for (const u of SAMPLES.users) {
    await ensureExtraUser(u.email, u.password, u.name, u.role);
  }

  // Create extra events
  for (const e of SAMPLES.events) {
    await ensureExtraEvent(
      e.id,
      e.mbAlbumId,
      e.title,
      e.dateOffset,
      e.status,
      e.location,
      e.extras,
      adminUid,
    );
  }

  // Add RSVP to sample event
  await addRsvps('seed-sample-event', adminUid);

  // Create products
  for (let i = 0; i < SAMPLES.products.length; i++) {
    const p = SAMPLES.products[i];
    await ensureProduct(p.emoji, p.name, p.description, p.price, i + 1);
  }

  // Create links
  for (let i = 0; i < SAMPLES.links.length; i++) {
    const l = SAMPLES.links[i];
    await ensureLink(l.emoji, l.title, l.url, i + 1);
  }

  // Create banners
  for (let i = 0; i < SAMPLES.banners.length; i++) {
    const b = SAMPLES.banners[i];
    await ensureBanner(b.imageUrl, b.altText, b.routes, b.link, i + 1);
  }

  console.log('[seed-extra] done.');
}

main().then(
  () => process.exit(0),
  (err: Error) => {
    console.error(err.message);
    process.exit(1);
  },
);
