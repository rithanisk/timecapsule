import { type ButtonHTMLAttributes, type ReactNode, useState } from 'react';
import { Link } from 'wouter';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Copy, Download, Heart, Home, Hourglass, Image, Link2, LoaderCircle, Share2, Sparkles, Trash2, Users } from 'lucide-react';
import { frameAssetUrl, frameOverlayFilter, getFrameLayout, photoIndexForSlot } from '@/lib/frame-layouts';

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? 'text-[#fffdf8]' : 'text-[#292723]'} inline-flex items-center gap-2 no-underline`} data-testid="link-home">
    <span className="grid size-9 place-items-center rounded-[12px] border border-[#d67a6d] bg-[#fffdf8] text-[#c76559]"><Hourglass size={19} strokeWidth={1.8} /></span>
    <span className="font-semibold tracking-[-.04em]">timecapsule</span>
  </Link>;
}

export function Shell({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <main className={`min-h-[100dvh] ${dark ? 'bg-[#292723] text-[#fffdf8]' : 'text-[#292723]'}`}>
    <div className="mx-auto w-full max-w-[1180px] px-5 pb-28 sm:px-8 sm:pb-16">{children}</div>
    <MobileNav />
  </main>;
}

function MobileNav() {
  const [path, navigate] = useLocation();
  const routeToken = path.match(/\/(?:booth|join)\/([^/]+)/)?.[1];
  const token = routeToken ?? localStorage.getItem('tc-active-booth') ?? '';
  const participantKey = token ? Object.keys(localStorage).find((key) => key.startsWith(`tc-participant:${token}:`)) : undefined;
  const slotId = participantKey?.slice(`tc-participant:${token}:`.length);
  const cameraPath = token ? slotId ? `/join/${token}/capture?slot=${encodeURIComponent(slotId)}` : `/join/${token}` : '/create';
  const items = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Booth', icon: Users, path: token ? `/booth/${token}` : '/create' },
    { label: 'Camera', icon: Camera, path: cameraPath, featured: true },
    { label: 'Invite', icon: Share2, path: token ? `/join/${token}` : '/create' },
    { label: 'Keepsake', icon: Sparkles, path: token ? `/booth/${token}/reveal` : '/create' },
  ];
  return <nav className="mobile-nav" aria-label="Main navigation">{items.map(({ label, icon: Icon, path: target, featured }) => <button key={label} type="button" aria-label={label} aria-current={path === target ? 'page' : undefined} className={`mobile-nav-item ${featured ? 'mobile-nav-camera' : ''}`} onClick={() => navigate(target)}><Icon size={featured ? 24 : 20} strokeWidth={featured ? 2.2 : 1.8} /><span>{label}</span></button>)}</nav>;
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

export function ProgressDots({ total, complete, noun = 'frames' }: { total: number; complete: number; noun?: string }) {
  return <div className="flex flex-wrap gap-2" aria-label={`${complete} of ${total} ${noun} confirmed`}>
    {Array.from({ length: total }, (_, index) => <span key={index} className={`size-3 rounded-full ${index < complete ? 'bg-[#a9c7bd]' : 'border border-[#bdb3a7] bg-[#fffdf8]'}`} />)}
  </div>;
}

export function FramePreview({ photos, layout, people, photosPerPerson, caption, frameColor = '#fffdf8', compact = false, filter = 'original', frameType = 'clean', objects = [], showDate = true, captionPosition = 'bottom', captionFont = 'serif', slotAdjustments = [], renderCell, stickerImageMap = {} }: {
  photos: string[]; layout: string; people?: number; photosPerPerson?: number; mode?: string; caption?: string; frameColor?: string; compact?: boolean; filter?: string; frameType?: string;
  objects?: Array<{ id: string; kind: string; label: string; x: number; y: number; rotation: number; color: string; zIndex: number }>;
  showDate?: boolean; captionPosition?: string; captionFont?: string;
  slotAdjustments?: Array<{ slotIndex: number; panX: number; panY: number; scale: number }>;
  renderCell?: (photo: string, index: number) => React.ReactNode;
  stickerImageMap?: Record<string, string>;
}) {
  const perPerson = photosPerPerson ?? 1;
  const frame = getFrameLayout(layout, people ?? Math.max(1, Math.ceil(photos.length / perPerson)), perPerson);
  const asset = frameAssetUrl(frame);
  const fontClass = captionFont === 'handwritten' ? 'font-handwritten' : captionFont === 'sans' ? 'font-sans' : '';
  const captionEl = caption ? <p className={`frame-caption ${captionPosition === 'top' ? 'is-top' : ''} ${fontClass}`}>{caption}</p> : null;
  return <div className={`frame-composition ${compact ? 'is-compact' : ''} frame-treatment-${frameType || 'clean'}`} style={{ aspectRatio: `${frame.width} / ${frame.height}`, backgroundColor: frameColor }} data-testid="artifact-preview">
    {frame.slots.map((slot) => {
        const i = photoIndexForSlot(slot, perPerson);
        const photo = photos[i] ?? '';
        const adj = slotAdjustments?.find((a) => a.slotIndex === i);
        const cellStyle: React.CSSProperties = photo ? {
          backgroundImage: `url("${photo}")`,
          ...(adj ? { backgroundPosition: `${50 - adj.panX * 50}% ${50 - adj.panY * 50}%`, backgroundSize: `${(adj.scale ?? 1) * 100}%` } : {}),
        } : {};
        return <div key={`${slot.person}-${slot.photo}`} className={`frame-slot filter-${filter || 'original'}`} style={{ left: `${slot.x / frame.width * 100}%`, top: `${slot.y / frame.height * 100}%`, width: `${slot.w / frame.width * 100}%`, height: `${slot.h / frame.height * 100}%`, transform: `rotate(${slot.rotation}deg)`, zIndex: slot.z }}>
          {renderCell ? renderCell(photo, i) : <div className={`photo-cell tone-${i % 4}`} style={cellStyle}>{!photo && <div className="silhouette" aria-label={`Frame ${i + 1} waiting`}><span /></div>}</div>}
        </div>;
      })}
    <img className="frame-overlay" src={asset} alt="" draggable={false} style={{ filter: frameOverlayFilter(frameType) }} />
    {(['solid', 'pattern', 'seasonal'].includes(frameType) || (frameType === 'clean' && frameColor.toLowerCase() !== '#fffdf8')) && <span className="frame-color-overlay" style={{ backgroundColor: frameColor, maskImage: `url("${asset}")`, WebkitMaskImage: `url("${asset}")` }} />}
    {captionEl}
    {objects.map((object) => <span key={object.id} className={`artifact-object artifact-object-${object.kind}`} style={{ left: `${object.x * 100}%`, top: `${object.y * 100}%`, zIndex: 110 + object.zIndex, color: object.color, transform: `translate(-50%,-50%) rotate(${object.rotation}deg)` }}>{object.kind === 'sticker' && stickerImageMap?.[object.label] ? <img src={stickerImageMap[object.label]} alt={object.label} className="size-8 object-contain sm:size-12" /> : object.label}</span>)}
    {showDate && !compact && <small className="frame-date">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</small>}
  </div>;
}

export function CopyButton({ text, children = 'Copy link' }: { text: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('Copy this private link', text); } };
  return <Button variant="secondary" onClick={copy} data-testid="button-copy-link">{copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} />{children}</>}</Button>;
}

export function SlotList({ slots, photosPerPerson = 1 }: { slots: Array<{ id: string; displayName: string; claimStatus: string; photoUrl: string | null }>; photosPerPerson?: number }) {
  const groups = Array.from({ length: Math.ceil(slots.length / photosPerPerson) }, (_, index) => slots.slice(index * photosPerPerson, (index + 1) * photosPerPerson));
  return <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
    {groups.map((group, index) => {
      const slot = group[0];
      const complete = group.every((item) => item.claimStatus === 'submitted');
      const submitted = group.filter((item) => item.claimStatus === 'submitted').length;
      return <li key={slot.id} className="flex min-h-[76px] items-center gap-3 rounded-2xl border border-[#e3dcd1] bg-[#fffdf8] p-3" data-testid={`slot-status-${slot.id}`}>
        <span className={`grid size-12 place-items-center rounded-xl text-lg font-semibold ${['bg-[#e9c9bf]','bg-[#d7e5df]','bg-[#dce5f2]','bg-[#f2e5c8]'][index % 4]}`}>{slot.displayName?.slice(0,1).toUpperCase() || '?'}</span>
        <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{slot.displayName || `Person ${index + 1}`}</strong><small className="text-xs text-[#756f66]">{complete ? 'Finalized' : submitted ? `${submitted} of ${group.length} photos finalized` : group.some((item) => item.claimStatus === 'claimed' || item.claimStatus === 'staged') ? 'Choosing moments' : 'Waiting for a friend'}</small></span>
        {complete ? <Check size={18} className="text-[#5e8e7e]" /> : <span className="size-2 rounded-full bg-[#e4c989]" />}
      </li>;
    })}
  </ul>;
}

export { ArrowLeft, ArrowRight, Camera, Check, ChevronDown, Copy, Download, Heart, Image, Link2, LoaderCircle, Share2, Sparkles, Trash2 };
