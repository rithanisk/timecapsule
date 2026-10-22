import { and, asc, eq, isNull } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { boothSlotsTable, boothsTable, db, type Booth } from '@workspace/db';
import manifest from '../../../timecapsule/src/lib/frame-layouts.json';
import { ObjectStorageService } from './objectStorage';

const storage = new ObjectStorageService();
const pending = new Map<string, Promise<string | null>>();
type Slot = typeof boothSlotsTable.$inferSelect;
type Frame = { width: number; height: number; file: string; generated?: boolean; slots: Array<{ person: number; photo: number; w: number; h: number; x: number; y: number; cx: number; cy: number; rotation: number; z: number }> };
const styles = manifest.styles as unknown as Record<string, Record<string, Frame>>;
const stickerFiles: Record<string, string> = {
  Cherry: 'cherry-svgrepo-com.svg', Strawberry: 'strawberry-svgrepo-com.svg',
  Watermelon: 'watermelon-svgrepo-com.svg', Pineapple: 'pineapple-svgrepo-com.svg',
  Banana: 'banana-svgrepo-com.svg', Flower: 'flower-green-svgrepo-com.svg',
  Leaf: 'leaf-organic-flora-svgrepo-com.svg', Leaves: 'bushes-of-leaves-svgrepo-com.svg',
  Bird: 'bird-svgrepo-com.svg', Flamingo: 'flamingo-svgrepo-com.svg',
  Champagne: 'champagne-party-svgrepo-com.svg', Confetti: 'party-confetti-svgrepo-com.svg',
  Cupcake: 'cupcake-svgrepo-com.svg', Pancake: 'pancake-svgrepo-com.svg',
};

function styleFor(layout: string) {
  if (['horizontal', 'double', 'side-by-side'].includes(layout)) return 'side-by-side';
  if (['grid', 'collage'].includes(layout)) return 'collage';
  if (layout === 'polaroid-stack') return 'polaroid';
  return styles[layout] ? layout : 'photostrip';
}

function xml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

async function frameOverlay(frame: Frame): Promise<Buffer> {
  if (frame.generated) {
    const holes = frame.slots.map(({ x, y, w, h }) => `M${x} ${y}h${w}v${h}h-${w}Z`).join('');
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><path fill="#fffdf8" fill-rule="evenodd" d="M0 0h${frame.width}v${frame.height}H0Z${holes}"/></svg>`);
  }
  const relative = path.join('photobooth-frames', frame.file);
  const candidates = [
    path.resolve(process.cwd(), 'artifacts/timecapsule/public', relative),
    path.resolve(process.cwd(), 'artifacts/timecapsule/dist/public', relative),
    path.resolve(process.cwd(), 'public', relative),
    path.resolve(process.cwd(), '../timecapsule/public', relative),
    path.resolve(process.cwd(), '../timecapsule/dist/public', relative),
  ];
  for (const candidate of candidates) {
    try { return await readFile(candidate); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Frame asset unavailable: ${relative}`);
}

async function stickerAsset(name: string): Promise<Buffer> {
  const file = stickerFiles[name];
  if (!file) throw new Error(`Unknown sticker: ${name}`);
  for (const candidate of [path.resolve(process.cwd(), 'assets', file), path.resolve(process.cwd(), '../../assets', file)]) {
    try { return await readFile(candidate); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error(`Sticker asset unavailable: ${file}`);
}

export async function renderStripPng(booth: Booth, sources: Buffer[]): Promise<Buffer> {
  const design = booth.customization as Record<string, unknown>;
  const photosPerPerson = Math.max(1, booth.photosPerPerson);
  const people = Math.ceil(booth.participantCount / photosPerPerson);
  const frame = styles[styleFor(String(design.layout || booth.layout))]?.[`${people}x${photosPerPerson}`];
  if (!frame) throw new Error('Photostrip layout unavailable');
  const adjustments = Array.isArray(design.slotAdjustments) ? design.slotAdjustments as Array<{ slotIndex: number; panX: number; panY: number; scale: number }> : [];
  const layers: OverlayOptions[] = [];
  for (const cell of [...frame.slots].sort((a, b) => a.z - b.z)) {
    const index = (cell.person - 1) * photosPerPerson + cell.photo - 1;
    const source = sources[index];
    if (!source) throw new Error('Photostrip source photo unavailable');
    const width = Math.max(1, Math.round(cell.w));
    const height = Math.max(1, Math.round(cell.h));
    const adjustment = adjustments.find((item) => item.slotIndex === index);
    const panX = Math.max(-1, Math.min(1, Number(adjustment?.panX ?? 0)));
    const panY = Math.max(-1, Math.min(1, Number(adjustment?.panY ?? 0)));
    const scale = Math.max(1, Math.min(3, Number(adjustment?.scale ?? 1)));
    const metadata = await sharp(source).metadata();
    const imageWidth = metadata.width || width;
    const imageHeight = metadata.height || height;
    const cropWidth = Math.max(1, Math.min(imageWidth, Math.round(Math.min(imageWidth, imageHeight * width / height) / scale)));
    const cropHeight = Math.max(1, Math.min(imageHeight, Math.round(Math.min(imageHeight, imageWidth * height / width) / scale)));
    const left = Math.round((imageWidth - cropWidth) * (1 - panX) / 2);
    const top = Math.round((imageHeight - cropHeight) * (1 - panY) / 2);
    let photo = sharp(source).extract({ left, top, width: cropWidth, height: cropHeight }).resize(width, height);
    const filter = String(design.filter || 'original');
    if (filter === 'soft-bw') photo = photo.greyscale().linear(0.96, 4);
    if (filter === 'high-contrast') photo = photo.linear(1.18, -18);
    if (filter === 'warm-film' || filter === 'sepia') photo = photo.tint(filter === 'sepia' ? '#bd906c' : '#e1ba96');
    if (filter === 'faded') photo = photo.modulate({ saturation: 0.62, brightness: 1.08 });
    if (filter === 'disposable') photo = photo.modulate({ saturation: 1.16 }).linear(1.08, -10);
    if (filter === 'cool-flash') photo = photo.modulate({ saturation: 0.82, brightness: 1.04 });
    if (design.frameType === 'film' || design.frameType === 'film-noir') photo = photo.greyscale().linear(1.15, -18);
    if (design.frameType === 'retro') photo = photo.tint('#e7d8bf').linear(0.96, 5);
    let rotated = await photo.png().rotate(cell.rotation, { background: '#00000000' }).toBuffer();
    const rotatedMeta = await sharp(rotated).metadata();
    let x = Math.round(cell.cx - (rotatedMeta.width || width) / 2);
    let y = Math.round(cell.cy - (rotatedMeta.height || height) / 2);
    const clipX = Math.max(0, -x);
    const clipY = Math.max(0, -y);
    const clipWidth = Math.min(rotatedMeta.width || width, frame.width - x) - clipX;
    const clipHeight = Math.min(rotatedMeta.height || height, frame.height - y) - clipY;
    if (clipWidth <= 0 || clipHeight <= 0) continue;
    if (clipX || clipY || clipWidth !== rotatedMeta.width || clipHeight !== rotatedMeta.height) {
      rotated = await sharp(rotated).extract({ left: clipX, top: clipY, width: clipWidth, height: clipHeight }).png().toBuffer();
      x += clipX; y += clipY;
    }
    layers.push({ input: rotated, left: x, top: y });
  }
  let overlay = await frameOverlay(frame);
  if (design.frameType === 'black' || design.frameType === 'film-noir') overlay = await sharp(overlay).negate({ alpha: false }).png().toBuffer();
  if (design.frameType === 'solid' && typeof design.frameColor === 'string') {
    const color = await sharp({ create: { width: frame.width, height: frame.height, channels: 4, background: design.frameColor } }).png().toBuffer();
    overlay = await sharp(color).composite([{ input: overlay, blend: 'dest-in' }]).png().toBuffer();
  }
  layers.push({ input: overlay, left: 0, top: 0 });
  if (design.frameType === 'pattern' || design.frameType === 'seasonal') {
    const paint = design.frameType === 'pattern'
      ? `<defs><pattern id="p" width="17" height="17" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="17" height="17" fill="rgba(255,253,248,.25)"/><path d="M0 0V17" stroke="rgba(229,120,106,.2)" stroke-width="7"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/>`
      : `<defs><pattern id="p" width="45" height="45" patternUnits="userSpaceOnUse"><circle cx="7" cy="9" r="2.5" fill="#d36d63"/><circle cx="34" cy="5" r="2.5" fill="#6c9b81"/><circle cx="22" cy="38" r="2.5" fill="#d36d63"/></pattern></defs><rect width="100%" height="100%" fill="url(#p)"/>`;
    const painted = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">${paint}</svg>`))
      .composite([{ input: overlay, blend: 'dest-in' }]).png().toBuffer();
    layers.push({ input: painted, left: 0, top: 0 });
  }
  const ink = ['black', 'film', 'film-noir'].includes(String(design.frameType)) ? '#fffdf8' : '#292723';
  const text: string[] = [];
  if (typeof design.caption === 'string' && design.caption) {
    const y = design.captionPosition === 'top' ? 55 : frame.height - 55;
    text.push(`<text x="${frame.width / 2}" y="${y}" text-anchor="middle" font-family="Georgia,serif" font-style="italic" font-size="38" fill="${ink}">${xml(design.caption)}</text>`);
  }
  if (design.showDate) {
    const date = (booth.completedAt || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    text.push(`<text x="${frame.width / 2}" y="${frame.height - 18}" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="${ink}">${xml(date)}</text>`);
  }
  if (text.length) layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}">${text.join('')}</svg>`), left: 0, top: 0 });
  if (Array.isArray(design.objects)) {
    for (const item of design.objects as Array<{ kind: string; label: string; x: number; y: number; rotation: number; color: string }>) {
      const x = Number(item.x) * frame.width;
      const y = Number(item.y) * frame.height;
      const angle = Number(item.rotation) || 0;
      if (item.kind === 'sticker' && stickerFiles[item.label]) {
        const sticker = await sharp(await stickerAsset(item.label)).resize(100, 100, { fit: 'contain' }).png().toBuffer();
        let rendered = await sharp(sticker).rotate(angle, { background: '#00000000' }).toBuffer();
        const meta = await sharp(rendered).metadata();
        let left = Math.round(x - (meta.width || 100) / 2);
        let top = Math.round(y - (meta.height || 100) / 2);
        const cropLeft = Math.max(0, -left);
        const cropTop = Math.max(0, -top);
        const cropWidth = Math.min(meta.width || 100, frame.width - left) - cropLeft;
        const cropHeight = Math.min(meta.height || 100, frame.height - top) - cropTop;
        if (cropWidth > 0 && cropHeight > 0) {
          if (cropLeft || cropTop || cropWidth !== meta.width || cropHeight !== meta.height) {
            rendered = await sharp(rendered).extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight }).png().toBuffer();
            left += cropLeft; top += cropTop;
          }
          layers.push({ input: rendered, left, top });
        }
      } else {
        const label = xml(String(item.label));
        const color = xml(String(item.color || '#292723'));
        const size = item.kind === 'text' ? 30 : 48;
        layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><g transform="translate(${x} ${y}) rotate(${angle})"><text text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="${size}" fill="${color}">${label}</text></g></svg>`), left: 0, top: 0 });
      }
    }
  }
  let composite = await sharp({ create: { width: frame.width, height: frame.height, channels: 4, background: String(design.frameColor || '#fffdf8') } }).composite(layers).png().toBuffer();
  if (design.frameType === 'torn') {
    const points = [`0,0`, `${frame.width},0`, `${frame.width},${frame.height * .985}`];
    for (let percent = 95; percent >= 0; percent -= 5) points.push(`${frame.width * percent / 100},${frame.height * (percent % 10 === 0 ? .987 : 1)}`);
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><polygon points="${points.join(' ')}" fill="white"/></svg>`);
    composite = await sharp(composite).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
  }
  if (design.frameType === 'whimsical') {
    const border = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}"><rect x="3" y="3" width="${frame.width - 6}" height="${frame.height - 6}" rx="20" fill="none" stroke="#e5786a" stroke-width="3" stroke-dasharray="10 8"/></svg>`);
    composite = await sharp(composite).composite([{ input: border, left: 0, top: 0 }]).png().toBuffer();
  }
  return sharp(composite).resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).png({ compressionLevel: 9 }).toBuffer();
}

async function removeSourcePhotos(slots: Slot[]) {
  await Promise.all(slots.map(async (slot) => {
    if (!slot.mediaPath) return;
    try {
      const file = await storage.getObjectEntityFile(slot.mediaPath);
      await file.delete({ ignoreNotFound: true });
    } catch (error) {
      if ((error as Error).name !== 'ObjectNotFoundError') throw error;
    }
    await db.update(boothSlotsTable).set({ mediaPath: null, width: null, height: null, captureSource: null }).where(and(eq(boothSlotsTable.id, slot.id), eq(boothSlotsTable.mediaPath, slot.mediaPath)));
  }));
}

async function buildAndStore(boothId: string): Promise<string | null> {
  const [booth] = await db.select().from(boothsTable).where(eq(boothsTable.id, boothId)).limit(1);
  if (!booth || booth.status === 'deleted') return null;
  const slots = await db.select().from(boothSlotsTable).where(eq(boothSlotsTable.boothId, booth.id)).orderBy(asc(boothSlotsTable.position));
  if (booth.stripPath) {
    if (slots.some((slot) => slot.mediaPath)) await removeSourcePhotos(slots);
    return booth.stripPath;
  }
  if (slots.length !== booth.participantCount || !slots.every((slot) => slot.claimStatus === 'submitted' && slot.mediaPath)) return null;
  const sources = await Promise.all(slots.map(async (slot) => {
    const file = await storage.getObjectEntityFile(slot.mediaPath!);
    const [buffer] = await file.download();
    return buffer;
  }));
  const png = await renderStripPng(booth, sources);
  const newPath = await storage.savePrivatePng(png);
  let saved: { stripPath: string | null } | undefined;
  try {
    [saved] = await db.update(boothsTable).set({ stripPath: newPath }).where(and(eq(boothsTable.id, booth.id), isNull(boothsTable.stripPath))).returning({ stripPath: boothsTable.stripPath });
  } catch (error) {
    try { await (await storage.getObjectEntityFile(newPath)).delete({ ignoreNotFound: true }); } catch { /* Keep the original failure. */ }
    throw error;
  }
  if (!saved) {
    const file = await storage.getObjectEntityFile(newPath);
    await file.delete({ ignoreNotFound: true });
  }
  const [current] = saved ? [saved] : await db.select({ stripPath: boothsTable.stripPath }).from(boothsTable).where(eq(boothsTable.id, booth.id)).limit(1);
  if (current?.stripPath) await removeSourcePhotos(slots);
  return current?.stripPath ?? null;
}

export function ensureStripImage(boothId: string): Promise<string | null> {
  const existing = pending.get(boothId);
  if (existing) return existing;
  const work = buildAndStore(boothId).finally(() => pending.delete(boothId));
  pending.set(boothId, work);
  return work;
}

export async function migrateCompletedStrips(onError: (boothId: string, error: unknown) => void): Promise<void> {
  const booths = await db.select({ id: boothsTable.id }).from(boothsTable).where(eq(boothsTable.status, 'complete'));
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(2, booths.length) }, async () => {
    while (next < booths.length) {
      const boothId = booths[next++].id;
      try { await ensureStripImage(boothId); } catch (error) { onError(boothId, error); }
    }
  }));
}
