import sharp from 'sharp';

/**
 * Download an image URL and return a tiny base64 JPEG blur placeholder.
 * ~300-500 bytes — safe to store inline in Firestore.
 */
export async function generateBlurPlaceholder(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const tiny = await sharp(buffer)
      .resize(20, 20, { fit: 'cover' })
      .blur(2)
      .jpeg({ quality: 40 })
      .toBuffer();
    return `data:image/jpeg;base64,${tiny.toString('base64')}`;
  } catch {
    return null;
  }
}
