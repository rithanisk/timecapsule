import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Copy, Download, Heart, Image, Link2, LoaderCircle, LockKeyhole, Palette, Share2, Sparkles, Trash2 } from 'lucide-react';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'text-[#fffdf8]' : 'text-[#292723]'} inline-flex items-center gap-2 no-underline`} data-testid="link-home">
    <span className="grid size-9 place-items-center rounded-full bg-[#292723] text-[#fffdf8]"><Image size={17} /></span>
    <span className="font-semibold tracking-[-.04em]">timecapsule</span>
  </Link>;
}

export function Shell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <main className={`min-h-[100dvh] ${dark ? 'bg-[#292723] text-[#fffdf8]' : 'text-[#292723]'}`}>
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 sm:px-8">{children}</div>
  </main>;
}

export function TopBar({ right, dark = false }: { right?: ReactNode; dark?: boolean }) {
  return <header className="flex min-h-[76px] items-center justify-between border-b border-[#d9d1c5] dark:border-[#514d46]">
    <Brand light={dark} />{right ?? <span className={`flex items-center gap-2 text-xs ${dark ? 'text-[#cfc8be]' : 'text-[#756f66]'}`}><LockKeyhole size={14} /> Private by default</span>}
  </header>;
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button className={`${variant === 'primary' ? 'button-primary' : variant === 'secondary' ? 'button-secondary' : 'button-quiet'} inline-flex items-center justify-center gap-2 ${className}`} {...props}>{children}</button>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`paper-card rounded-[22px] p-5 sm:p-7 ${className}`}>{children}</section>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-2xl border border-[#e4b6aa] bg-[#f9e9e4] p-5 text-sm text-[#653b34]">
    <p>{message}</p>{onRetry && <Button variant="secondary" className="mt-3" onClick={onRetry}>Try again</Button>}
  </div>;
}

export function LoadingCard() {
  return <div aria-label="Loading booth" className="paper-card animate-pulse rounded-[22px] p-6"><div className="h-5 w-1/3 rounded bg-[#e8e0d5]" /><div className="mt-5 h-3 w-full rounded bg-[#eee8df]" /><div className="mt-3 h-3 w-2/3 rounded bg-[#eee8df]" /></div>;
}

export function ProgressDots({ total, complete }: { total: number; complete: number }) {
  return <div className="flex flex-wrap gap-2" aria-label={`${complete} of ${total} frames confirmed`}>
    {Array.from({ length: total }, (_, index) => <span key={index} className={`size-3 rounded-full ${index < complete ? 'bg-[#a9c7bd]' : 'border border-[#bdb3a7] bg-[#fffdf8]'}`} />)}
  </div>;
}

export function FramePreview({ photos, layout, mode, caption, frameColor = '#fffdf8', compact = false, filter = 'original', frameType = 'clean', objects = [], showDate = true, captionPosition = 'bottom', captionFont = 'serif', slotAdjustments = [], renderCell, stickerImageMap = {} }: {
  photos: string[]; layout: string; mode?: string; caption?: string; frameColor?: string; compact?: boolean; filter?: string; frameType?: string;
  objects?: Array<{ id: string; kind: string; label: string; x: number; y: number; rotation: number; color: string; zIndex: number }>;
  showDate?: boolean; captionPosition?: string; captionFont?: string;
  slotAdjustments?: Array<{ slotIndex: number; panX: number; panY: number; scale: number }>;
  renderCell?: (photo: string, index: number) => React.ReactNode;
  stickerImageMap?: Record<string, string>;
}) {
  const isStrip = layout === 'vertical' || layout === 'classic-strip';
  const cols = layout === 'polaroid-stack' ? '' : layout === 'horizontal' ? 'grid-cols-2' : layout === 'double' ? 'grid-cols-2' : layout === 'grid' || layout === 'freeform' ? 'grid-cols-2' : layout === 'mixed-sizes' ? 'grid-cols-2' : 'grid-cols-1';
  const displayPhotos = photos.length ? photos : Array.from({ length: 4 }, () => '');
  const fontClass = captionFont === 'handwritten' ? 'font-handwritten' : captionFont === 'sans' ? 'font-sans' : '';
  const captionEl = caption ? <p className={`photostrip-caption ${fontClass}`}>{caption}</p> : null;
  return <div className={`photostrip relative ${mode === 'scrapbook' ? 'scrapbook' : ''} ${compact ? 'photostrip-compact' : ''} ${isStrip ? 'layout-strip' : ''} frame-${frameType || 'clean'}`} style={{ backgroundColor: mode === 'scrapbook' ? '#dce8e3' : frameColor }}>
    {captionPosition === 'top' && captionEl}
    <div className={`photo-grid ${cols} ${layout} filter-${filter || 'original'}`} data-testid="artifact-preview">
      {displayPhotos.map((photo, i) => {
        if (renderCell) return renderCell(photo, i);
        const adj = slotAdjustments?.find((a) => a.slotIndex === i);
        const cellStyle: React.CSSProperties = photo ? {
          backgroundImage: `url("${photo}")`,
          ...(adj ? { backgroundPosition: `${50 - adj.panX * 50}% ${50 - adj.panY * 50}%`, backgroundSize: `${(adj.scale ?? 1) * 100}%` } : {}),
        } : {};
        return <div key={i} className={`photo-cell tone-${i % 4}`} style={cellStyle}>
          {!photo && <div className="silhouette" aria-label={`Frame ${i + 1} waiting`}><span /></div>}
        </div>;
      })}
    </div>
    {captionPosition !== 'top' && captionEl}
    {objects.map((object) => <span key={object.id} className={`artifact-object artifact-object-${object.kind}`} style={{ left: `${object.x * 100}%`, top: `${object.y * 100}%`, zIndex: object.zIndex, color: object.color, transform: `translate(-50%,-50%) rotate(${object.rotation}deg)` }}>{object.kind === 'sticker' && stickerImageMap?.[object.label] ? <img src={stickerImageMap[object.label]} alt={object.label} className="size-8 object-contain sm:size-12" /> : object.label}</span>)}
    {showDate && !compact && <small className="photostrip-date">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</small>}
    {!compact && <small className="photostrip-mark">DIFFERENT PLACES · ONE PHOTOBOOTH</small>}
  </div>;
}

export function CopyButton({ text, children = 'Copy link' }: { text: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this private link', text); } };
  return <Button variant="secondary" onClick={copy} data-testid="button-copy-link">{copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} />{children}</>}</Button>;
}

export function SlotList({ slots, hidePhotos = false }: { slots: Array<{ id: string; displayName: string; claimStatus: string; photoUrl: string | null }>; hidePhotos?: boolean }) {
  return <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
    {slots.map((slot, index) => <li key={slot.id} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-[#e3dcd1] bg-[#fffdf8] p-3" data-testid={`slot-status-${slot.id}`}>
      {slot.photoUrl && !hidePhotos ? <img src={slot.photoUrl} alt={`${slot.displayName} confirmed frame`} className="size-12 rounded-xl object-cover" /> : <span className={`grid size-12 place-items-center rounded-xl text-lg font-semibold ${['bg-[#e9c9bf]','bg-[#d7e5df]','bg-[#dce5f2]','bg-[#f2e5c8]'][index % 4]}`}>{slot.displayName?.slice(0,1).toUpperCase() || '?'}</span>}
      <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{slot.displayName || `Frame ${index + 1}`}</strong><small className="text-xs text-[#756f66]">{slot.claimStatus === 'submitted' ? 'Frame confirmed' : slot.claimStatus === 'claimed' ? 'Choosing a moment' : 'Waiting for a friend'}</small></span>
      {slot.claimStatus === 'submitted' ? <Check size={18} className="text-[#5e8e7e]" /> : <span className="size-2 rounded-full bg-[#e4c989]" />}
    </li>)}
  </ul>;
}

export { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Copy, Download, Heart, Image, Link2, LoaderCircle, Palette, Share2, Sparkles, Trash2 };
