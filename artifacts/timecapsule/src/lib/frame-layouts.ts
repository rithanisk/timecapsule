import manifest from './frame-layouts.json';

export type FrameStyle = 'photostrip' | 'side-by-side' | 'collage' | 'editorial' | 'polaroid' | 'freeform' | 'mixed-sizes';

export interface FrameSlotGeometry {
  person: number;
  photo: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  rotation: number;
  z: number;
}

export interface FrameGeometry {
  file: string;
  width: number;
  height: number;
  slots: FrameSlotGeometry[];
  generated?: boolean;
}

const layouts = manifest.styles as unknown as Record<FrameStyle, Record<string, FrameGeometry>>;

export function frameStyleForLayout(layout: string): FrameStyle {
  switch (layout) {
    case 'horizontal':
    case 'double':
    case 'side-by-side': return 'side-by-side';
    case 'grid':
    case 'collage': return 'collage';
    case 'editorial': return 'editorial';
    case 'polaroid-stack':
    case 'polaroid': return 'polaroid';
    case 'freeform': return 'freeform';
    case 'mixed-sizes': return 'mixed-sizes';
    default: return 'photostrip';
  }
}

export function getFrameLayout(layout: string, people: number, photosPerPerson: number | undefined): FrameGeometry {
  const style = frameStyleForLayout(layout);
  const safePeople = Math.max(1, Math.min(6, Math.round(people)));
  const safePhotos = Math.max(1, Math.min(5, Math.round(photosPerPerson ?? 1)));
  return layouts[style][`${safePeople}x${safePhotos}`];
}

export function frameAssetUrl(frame: FrameGeometry): string {
  if (frame.generated) {
    // Keep the frame overlay aligned with the slot coordinates in the manifest.
    const holes = frame.slots.map(({ x, y, w, h }) => `M${x} ${y}h${w}v${h}h-${w}Z`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}"><path fill="#fffdf8" fill-rule="evenodd" d="M0 0h${frame.width}v${frame.height}H0Z${holes}"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }
  return `${import.meta.env.BASE_URL}photobooth-frames/${frame.file}`;
}

export function frameOverlayFilter(frameType: string): string | undefined {
  if (frameType === 'black' || frameType === 'film-noir') return 'invert(1)';
  if (frameType === 'film') return 'grayscale(1) contrast(1.12)';
  if (frameType === 'polaroid') return 'sepia(.08) saturate(.9)';
  if (frameType === 'retro') return 'sepia(.32) saturate(.85)';
  if (frameType === 'seasonal') return 'sepia(.15) saturate(1.2)';
  return undefined;
}

export function photoIndexForSlot(slot: FrameSlotGeometry, photosPerPerson: number | undefined): number {
  return (slot.person - 1) * (photosPerPerson ?? 1) + slot.photo - 1;
}
