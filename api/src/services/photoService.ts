import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { adminDb } from '../config/firebase';
import { createR2Client, getR2PublicUrl } from '../config/r2';
import type { Photo, PhotoCategory } from '../types';

const EVENT_PHOTOS = 'event_photos';
const CATEGORIES: readonly PhotoCategory[] = ['category1', 'category2'] as const;

function extFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

function photoDocRef(
  eventId: string,
  category: PhotoCategory,
  photoId: string,
): FirebaseFirestore.DocumentReference {
  return adminDb
    .collection(EVENT_PHOTOS)
    .doc(eventId)
    .collection(category)
    .doc(photoId);
}

export async function uploadPhoto(
  eventId: string,
  category: PhotoCategory,
  userId: string,
  fileBuffer: Buffer,
  mimeType: string,
): Promise<Photo> {
  const photoId = randomUUID();
  const ext = extFromMime(mimeType);
  const objectKey = `event_photos/${eventId}/${category}/${photoId}.${ext}`;

  const client = createR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: 'quartinho-photos',
      Key: objectKey,
      Body: fileBuffer,
      ContentType: mimeType,
      Metadata: { uploadedBy: userId, eventId, category },
    }),
  );

  const url = getR2PublicUrl(objectKey);
  const now = Date.now();
  const photo: Photo = {
    id: photoId,
    url,
    category,
    uploadedBy: userId,
    createdAt: now,
  };
  await photoDocRef(eventId, category, photoId).set(photo);
  return photo;
}

export async function deletePhoto(
  eventId: string,
  category: PhotoCategory,
  photoId: string,
): Promise<boolean> {
  const ref = photoDocRef(eventId, category, photoId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const data = snap.data() as Photo;

  try {
    const objectKey = data.url.split('/').slice(-3).join('/');
    const client = createR2Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: 'quartinho-photos',
        Key: `event_photos/${eventId}/${category}/${photoId}.${objectKey.split('.').pop()}`,
      }),
    );
  } catch {
    // swallow — Firestore doc is the source of truth for the list view.
  }

  await ref.delete();
  return true;
}

export async function listPhotos(eventId: string): Promise<Photo[]> {
  const results: Photo[] = [];
  for (const category of CATEGORIES) {
    const snap = await adminDb
      .collection(EVENT_PHOTOS)
      .doc(eventId)
      .collection(category)
      .get();
    snap.forEach((doc) => {
      results.push(doc.data() as Photo);
    });
  }
  results.sort((a, b) => b.createdAt - a.createdAt);
  return results;
}
