import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type BoothCreated, type BoothInput, type BoothState, type CustomizationInput,
  type FrameConfirmInput, type FrameUploadInput, type PushSubscriptionInput, type SlotClaimInput,
} from '@workspace/api-client-react';
import {
  getGetBoothQueryKey, getGetMyBoothsQueryKey, useClaimBoothSlot, useConfirmBoothFrame, useCreateBooth,
  useDeleteBooth, useGetBooth, useGetMyBooths, useRequestFrameUpload,
  useSubscribeToBoothReady,
  saveBoothCustomization,
} from '@workspace/api-client-react';
import { useAuth } from '@/hooks/use-auth';
import { Brand, Button, CopyButton, ErrorNote, FramePreview, LoadingCard, Panel, ProgressDots, Shell, SlotList, ArrowLeft, ArrowRight, Camera, Check, Download, Heart, Image, Link2, LoaderCircle, Share2, Sparkles, Trash2 } from '@/components/timecapsule-ui';
import { sampleStripPhotos, sampleTemplatePhotos } from '@/home-samples';
import { useArchiveBooths } from '@/lib/archive';
import { frameAssetUrl, frameOverlayFilter, getFrameLayout, photoIndexForSlot } from '@/lib/frame-layouts';

// SVG asset stickers
import stickerCherry from '@assets/cherry-svgrepo-com.svg';
import stickerStrawberry from '@assets/strawberry-svgrepo-com.svg';
import stickerWatermelon from '@assets/watermelon-svgrepo-com.svg';
import stickerPineapple from '@assets/pineapple-svgrepo-com.svg';
import stickerBanana from '@assets/banana-svgrepo-com.svg';
import stickerFlower from '@assets/flower-green-svgrepo-com.svg';
import stickerLeaf from '@assets/leaf-organic-flora-svgrepo-com.svg';
import stickerBushes from '@assets/bushes-of-leaves-svgrepo-com.svg';
import stickerBird from '@assets/bird-svgrepo-com.svg';
import stickerFlamingo from '@assets/flamingo-svgrepo-com.svg';
import stickerChampagne from '@assets/champagne-party-svgrepo-com.svg';
import stickerConfetti from '@assets/party-confetti-svgrepo-com.svg';
import stickerCupcake from '@assets/cupcake-svgrepo-com.svg';
import stickerPancake from '@assets/pancake-svgrepo-com.svg';

const assetStickers: Array<{ src: string; label: string }> = [
  { src: stickerCherry, label: 'Cherry' },
  { src: stickerStrawberry, label: 'Strawberry' },
  { src: stickerWatermelon, label: 'Watermelon' },
  { src: stickerBanana, label: 'Banana' },
  { src: stickerPineapple, label: 'Pineapple' },
  { src: stickerFlower, label: 'Flower' },
  { src: stickerLeaf, label: 'Leaf' },
  { src: stickerBushes, label: 'Leaves' },
  { src: stickerBird, label: 'Bird' },
  { src: stickerFlamingo, label: 'Flamingo' },
  { src: stickerChampagne, label: 'Celebrate' },
  { src: stickerConfetti, label: 'Confetti' },
  { src: stickerCupcake, label: 'Cupcake' },
  { src: stickerPancake, label: 'Pancake' },
];
const stickerImageMap: Record<string, string> = Object.fromEntries(assetStickers.map((s) => [s.label, s.src]));

const layouts = [
  ['classic-strip', 'Photostrip'], ['horizontal', 'Side by side'], ['grid', 'Collage'],
  ['editorial', 'Editorial'], ['polaroid-stack', 'Polaroid'], ['freeform', 'Freeform'], ['mixed-sizes', 'Mixed sizes'],
] as const;
const fittedFrameWidth = (layout: string, people: number, perPerson: number | undefined, height: string) => {
  const frame = getFrameLayout(layout, people, perPerson);
  const limits = height.startsWith('min(') ? height.slice(4, -1).split(',').map((limit) => limit.trim()) : [height];
  return `min(100%, ${limits.map((limit) => `calc(${limit} * ${frame.width / frame.height})`).join(', ')})`;
};
const defaultPrompt = 'Look toward the next person.';
const creatorKey = (token: string) => `tc-creator:${token}`;
const participantKey = (token: string, slotId: string) => `tc-participant:${token}:${slotId}`;
const participantPrefix = (token: string) => `tc-participant:${token}:`;
const confirmedKey = (token: string, slotId: string) => `tc-confirmed:${token}:${slotId}`;
const activeBoothKey = 'tc-active-booth';

function findAccessToken(privateToken: string) {
  const creator = localStorage.getItem(creatorKey(privateToken));
  if (creator) return creator;
  const prefix = participantPrefix(privateToken);
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(prefix)) return localStorage.getItem(key) ?? '';
  }
  return '';
}

function useBooth(privateToken: string) {
  useEffect(() => {
    if (privateToken) localStorage.setItem(activeBoothKey, privateToken);
  }, [privateToken]);
  return useGetBooth(privateToken, { query: { queryKey: getGetBoothQueryKey(privateToken), enabled: Boolean(privateToken), refetchInterval: (query) => {
    const data = query.state.data as BoothState | undefined;
    return data && (data.revealAvailable || data.status === 'deleted') ? false : 7000;
  } } });
}

function getError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

const homeStrips = [
    { layout: 'horizontal', frameType: 'clean' },
    { layout: 'horizontal', frameType: 'retro' },
    { layout: 'vertical', frameType: 'film' },
    { layout: 'vertical', frameType: 'polaroid' },
    { layout: 'horizontal', frameType: 'torn' },
    { layout: 'horizontal', frameType: 'pattern' },
    { layout: 'horizontal', frameType: 'whimsical' },
    { layout: 'vertical', frameType: 'clean' },
    { layout: 'vertical', frameType: 'black' },
    { layout: 'horizontal', frameType: 'solid' },
];

function HomeSampleStrip({ photos, layout, frameType }: { photos: string[]; layout: string; frameType: string }) {
  return <div className={`photostrip relative photostrip-compact ${layout === 'vertical' ? 'layout-strip' : ''} frame-${frameType}`} style={{ backgroundColor: '#fffdf8' }}>
    <div className={`photo-grid grid-cols-2 ${layout}`}>
      {photos.map((photo, index) => <div key={index} className={`photo-cell tone-${index}`} style={{ backgroundImage: `url("${photo}")` }} />)}
    </div>
  </div>;
}

export function HomePage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { entries: archived, selectedIds } = useArchiveBooths();
  const myBoothsQuery = useGetMyBooths({ query: { queryKey: [...getGetMyBoothsQueryKey(), user?.id], enabled: Boolean(user) } });
  const myBooths = Array.isArray(myBoothsQuery.data) ? myBoothsQuery.data : [];
  const featured = user ? selectedIds.flatMap((id) => archived.filter((item) => item.id === id)) : [];
  return <Shell>
    <header className="flex min-h-[76px] items-center justify-between border-b border-[#d9d1c5]">
      <Brand />
      {user ? <span className="flex items-center gap-2 text-xs text-[#756f66]">Hi, {user.displayName}! <button type="button" onClick={() => void logout()} className="ml-1 inline-flex items-center gap-1 underline hover:opacity-70"><LogOut size={13} /> Sign out</button></span>
        : <Link href="/login" className="text-xs font-medium text-[#292723] underline">Sign in</Link>}
    </header>
    <section className="mx-auto max-w-[1100px] pb-8 pt-5 sm:pt-8">
      <div className="home-collage" aria-label="Welcome to your timecapsule">
        <div className="collage-center">
          <img className="collage-sticker collage-sticker-cherry" src={stickerCherry} alt="" />
          <img className="collage-sticker collage-sticker-flower" src={stickerFlower} alt="" />
          <img className="collage-sticker collage-sticker-bird" src={stickerBird} alt="" />
          <img className="collage-sticker collage-sticker-confetti" src={stickerConfetti} alt="" />
          <h1 className="serif collage-heading">{user ? <>Hi, <span className="text-[#E5786A]">{user.displayName}</span>!</> : 'Welcome to your'}</h1>
          {!user && <p className="serif collage-title">timecapsule!</p>}
          <p className="collage-subtitle">{user ? 'Your timecapsules are waiting.' : 'A private photobooth for the people you love. Take photos apart, reveal them together.'}</p>
          <div className="collage-actions">
            <Button onClick={() => navigate('/create')}>Start a timecapsule <ArrowRight size={17} /></Button>
          </div>
          {user && <Link href="/archive" className="mt-3 text-sm font-semibold text-[#c76559] underline underline-offset-4">Browse your photostrips</Link>}
          {!user && <p className="collage-signin">
            <Link href="/login?next=%2Fcreate" className="font-medium text-[#292723] underline">Sign in</Link> to create and save a timecapsule.
          </p>}
        </div>
        {homeStrips.map(({ layout, frameType }, index) => {
          const photos = sampleStripPhotos[index] ?? ['', ''];
          return <div key={index} className={`collage-strip collage-strip-${index} ${index >= 6 ? 'collage-mobile-extra' : ''}`} aria-hidden="true">
            <HomeSampleStrip photos={photos} layout={layout} frameType={frameType} />
          </div>;
        })}
      </div>

      {featured.length > 0 && <section className="mx-auto mt-10 max-w-[900px]" aria-labelledby="liked-photostrips-heading">
        <h2 id="liked-photostrips-heading" className="serif mb-4 text-center text-2xl">Liked photostrips</h2>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {featured.map((entry) => <Link key={entry.id} href={entry.token ? `/booth/${entry.token}/reveal` : `/archive/${entry.id}/reveal`} className="block min-w-0 no-underline" aria-label={`Open ${entry.booth.name}`}>
            <FramePreview photos={entry.booth.slots.map((slot) => slot.photoUrl ?? '')} layout={entry.booth.customization.layout || entry.booth.layout} people={entry.booth.participantCount} photosPerPerson={entry.booth.photosPerPerson} caption={entry.booth.customization.caption} frameColor={entry.booth.customization.frameColor} filter={entry.booth.customization.filter} frameType={entry.booth.customization.frameType} objects={entry.booth.customization.objects} showDate={false} captionPosition={entry.booth.customization.captionPosition} captionFont={entry.booth.customization.captionFont} slotAdjustments={entry.booth.customization.slotAdjustments} stickerImageMap={stickerImageMap} compact />
          </Link>)}
        </div>
      </section>}

      {user && myBooths.length > 0 && <div className="mx-auto mt-10 max-w-[700px] text-left">
        <h2 className="serif mb-4 text-lg">Your booths</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {myBooths.map((b) => <li key={b.id} className="flex items-center justify-between rounded-2xl border border-[#e3dcd1] bg-[#fffdf8] p-4">
            <div><strong className="block text-sm">{b.name}</strong><small className="text-xs text-[#756f66]">{b.participantCount} participants</small></div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.status === 'collecting' ? 'bg-[#f2e5c8] text-[#7a6530]' : b.status === 'complete' ? 'bg-[#d7e5df] text-[#3a6b52]' : 'bg-[#e8e0d5] text-[#756f66]'}`}>{b.status}</span>
          </li>)}
        </ul>
      </div>}
    </section>
  </Shell>;
}

export function ArchivePage() {
  const [, navigate] = useLocation();
  const reducedMotion = useReducedMotion();
  const { entries: archived, selectedIds, isLoading, error: archiveError, saveSelection } = useArchiveBooths();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selected, setSelected] = useState(selectedIds);
  const [selectionError, setSelectionError] = useState('');
  useEffect(() => setSelected(selectedIds), [selectedIds.join('|')]);
  const touchStart = useRef<number | null>(null);
  const current = archived[index] ?? archived[0];
  const move = useCallback((step: number) => {
    if (archived.length < 2) return;
    setDirection(step);
    setIndex((value) => (value + step + archived.length) % archived.length);
  }, [archived.length]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);
  const toggle = async () => {
    if (!current) return;
    const next = selected.includes(current.id) ? selected.filter((id) => id !== current.id) : [...selected, current.id].slice(0, 12);
    setSelected(next);
    setSelectionError('');
    try { await saveSelection(next); }
    catch (reason) { setSelected(selected); setSelectionError(getError(reason)); }
  };
  return <Shell>
    <div className="mx-auto max-w-[900px] py-5 sm:py-7">
      {!current && <div className="mb-3 text-center"><h1 className="serif text-3xl sm:text-4xl">Your photostrips.</h1><p className="mt-1 text-xs text-[#756f66]">Finished strips will appear here.</p></div>}
      {isLoading && !current ? <LoadingCard /> : !current ? <Panel className="py-16 text-center">{archiveError ? <ErrorNote message={getError(archiveError)} /> : <><h2 className="serif text-3xl">The archive is waiting.</h2><p className="text-[#756f66]">Finished photostrips will appear here.</p><Button onClick={() => navigate('/create')}>Start a timecapsule</Button></>}</Panel> : <>
        <div className="mb-3 text-center"><p className="mb-0 text-sm text-[#756f66]">{index + 1} of {archived.length} · {selected.length} liked</p><h1 className="serif mt-1 text-3xl">{current.booth.name}</h1></div>
        <div className="archive-stage" onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { if (touchStart.current === null) return; const distance = event.changedTouches[0].clientX - touchStart.current; if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1); touchStart.current = null; }}>
          <button className="archive-arrow" aria-label="Previous photostrip" disabled={archived.length < 2} onClick={() => move(-1)}><ArrowLeft size={22} /></button>
          <div className="archive-window"><AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div key={current.id} className="archive-print" style={{ width: fittedFrameWidth(current.booth.customization.layout || current.booth.layout, current.booth.participantCount, current.booth.photosPerPerson, 'min(40dvh, 420px)') }} custom={direction} variants={{ enter: (step: number) => ({ x: step > 0 ? '110%' : '-110%', opacity: 0, rotate: step > 0 ? 7 : -7 }), center: { x: 0, opacity: 1, rotate: 0 }, exit: (step: number) => ({ x: step > 0 ? '-110%' : '110%', opacity: 0, rotate: step > 0 ? -7 : 7 }) }} initial={reducedMotion ? false : 'enter'} animate="center" exit={reducedMotion ? undefined : 'exit'} transition={{ duration: reducedMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
              <FramePreview photos={current.booth.slots.map((slot) => slot.photoUrl ?? '')} layout={current.booth.customization.layout || current.booth.layout} people={current.booth.participantCount} photosPerPerson={current.booth.photosPerPerson} caption={current.booth.customization.caption} frameColor={current.booth.customization.frameColor} filter={current.booth.customization.filter} frameType={current.booth.customization.frameType} objects={current.booth.customization.objects} showDate={current.booth.customization.showDate} captionPosition={current.booth.customization.captionPosition} captionFont={current.booth.customization.captionFont} slotAdjustments={current.booth.customization.slotAdjustments} stickerImageMap={stickerImageMap} />
            </motion.div>
          </AnimatePresence></div>
          <button className="archive-arrow" aria-label="Next photostrip" disabled={archived.length < 2} onClick={() => move(1)}><ArrowRight size={22} /></button>
        </div>
        <div className="mx-auto mt-3 flex max-w-[600px] items-center justify-center gap-5"><button type="button" className={`archive-heart ${selected.includes(current.id) ? 'is-liked' : ''}`} aria-label={selected.includes(current.id) ? 'Unlike photostrip' : 'Like photostrip'} aria-pressed={selected.includes(current.id)} title={selected.includes(current.id) ? 'Remove from home page' : 'Show on home page'} disabled={!selected.includes(current.id) && selected.length >= 12} onClick={() => void toggle()}><Heart size={29} fill={selected.includes(current.id) ? 'currentColor' : 'none'} strokeWidth={1.8} /></button><Button variant="quiet" onClick={() => navigate(current.token ? `/booth/${current.token}/reveal` : `/archive/${current.id}/reveal`)}>Open keepsake</Button><Button variant="quiet" onClick={() => navigate('/')}>Home</Button></div>
        {selectionError && <div className="mx-auto mt-4 max-w-[600px]"><ErrorNote message={selectionError} /></div>}
      </>}
    </div>
  </Shell>;
}
function LockGlyph() { return <span aria-hidden="true" className="inline-grid size-5 place-items-center rounded-full border border-[#d9d1c5] text-[10px]">●</span>; }

export function CreateBoothPage() {
  const [, navigate] = useLocation();
  const createBooth = useCreateBooth();
  const claimSlot = useClaimBoothSlot();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [occasion, setOccasion] = useState('');
  const [count, setCount] = useState(4);
  const [names, setNames] = useState(['', '', '', '']);
  const [frameType, setFrameType] = useState<CustomizationInput['frameType']>('clean');
  const [layout, setLayout] = useState<(typeof layouts)[number][0]>('classic-strip');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [photosPerPerson, setPhotosPerPerson] = useState(1);
  const [countdownSeconds, setCountdownSeconds] = useState<3|5|10>(5);
  const [createdBooth, setCreatedBooth] = useState<BoothCreated | null>(null);
  const [setupError, setSetupError] = useState('');
  const [savingFrame, setSavingFrame] = useState(false);
  const previewPhotos = useMemo(() => sampleTemplatePhotos(count, photosPerPerson), [count, photosPerPerson]);
  const frameColor = frameType === 'solid' ? '#E5786A' : '#FFFDF8';
  const setNameAt = (index: number, value: string) => setNames((prev) => prev.map((item, i) => i === index ? value : item));
  const finishCreatedBooth = async (created: BoothCreated) => {
    setSavingFrame(true);
    setSetupError('');
    try {
      await saveBoothCustomization(created.privateToken, { mode: 'classic', layout, frameType, frameColor, filter: 'original', showDate: true, caption: '', captionPosition: 'bottom', captionFont: 'serif', objects: [], slotAdjustments: [] }, { headers: { 'X-Creator-Token': created.creatorToken } });
    } catch (reason) {
      setSetupError(`The frame could not be saved. ${getError(reason)} Try again before taking photos.`);
      setSavingFrame(false);
      return;
    }
    setSavingFrame(false);
    const firstSlot = created.state.slots[0];
    if (firstSlot) {
      const claimData: SlotClaimInput = { displayName: names[0]?.trim() || 'Friend 1', slotId: firstSlot.id };
      claimSlot.mutate({ privateToken: created.privateToken, data: claimData }, { onSuccess: (result) => {
        localStorage.setItem(participantKey(created.privateToken, result.slotId), result.participantToken);
        navigate(`/join/${created.privateToken}/capture?slot=${encodeURIComponent(result.slotId)}`);
      }, onError: () => navigate(`/booth/${created.privateToken}`) });
    } else navigate(`/booth/${created.privateToken}`);
  };
  const submit = () => {
    if (createdBooth) { void finishCreatedBooth(createdBooth); return; }
    const slots = Array.from({ length: count }, (_, i) => names[i]?.trim() || `Friend ${i + 1}`);
    const data: BoothInput = { name: name.trim(), subtitle: subtitle.trim(), occasion: occasion.trim(), participantCount: count, slots, mode: 'classic', layout, prompt, countdownSeconds, photosPerPerson, revealMode: 'complete', scheduledRevealAt: null };
    createBooth.mutate({ data }, { onSuccess: (created) => {
      localStorage.setItem(creatorKey(created.privateToken), created.creatorToken);
      setCreatedBooth(created);
      void finishCreatedBooth(created);
    } });
  };
  return <Shell>
    <div className="mx-auto max-w-[760px] py-8 sm:py-12">
      <button onClick={() => step === 1 ? navigate('/') : setStep(step - 1)} className="button-quiet mb-5 inline-flex items-center gap-2 !px-0"><ArrowLeft size={16} /> Back</button>
      <div className="mb-7 flex items-center justify-between"><p className="eyebrow">A few details, then it’s yours</p><span className="text-xs text-[#756f66]">STEP {step} OF 3</span></div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-[#e9e2d8]"><div className="h-full rounded-full bg-[#e5786a] transition-all" style={{ width: `${step * 33.333}%` }} /></div>
      <Panel>
        {step === 1 && <div><h1 className="serif text-4xl sm:text-5xl">Name your little corner.</h1><p className="mb-7 mt-2 text-[#6f685f]">Make it sound like your group—not a template.</p>
          <label className="field-label" htmlFor="booth-name">Booth name</label><input id="booth-name" data-testid="input-booth-name" className="input-paper mb-5" maxLength={50} placeholder="Four time zones, still us" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label" htmlFor="booth-subtitle">A little note (optional)</label><input id="booth-subtitle" className="input-paper mb-5" maxLength={80} placeholder="For the people who feel like home" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          <label className="field-label" htmlFor="occasion">What are you celebrating?</label><input id="occasion" className="input-paper mb-6" maxLength={40} placeholder="Birthday, just because, reunion…" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
          <span className="field-label">How many people?</span><div className="mb-7 flex gap-3">{[1,2,3,4,5,6].map((n) => <button key={n} aria-pressed={count === n} onClick={() => { setCount(n); setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? '')); }} className={`grid size-12 min-h-11 min-w-11 place-items-center rounded-full border font-semibold ${count === n ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{n}</button>)}</div>
          <span className="field-label">Photos per person</span><div className="mb-7 flex gap-3">{[1,2,3,4,5].map((n) => <button key={n} aria-pressed={photosPerPerson === n} onClick={() => setPhotosPerPerson(n)} className={`grid size-12 min-h-11 min-w-11 place-items-center rounded-full border font-semibold ${photosPerPerson === n ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{n}</button>)}</div>
          <span className="field-label">Each person's name</span><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: count }, (_, i) => <label key={i} className="flex items-center gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${['bg-[#ecd1c8]','bg-[#d5e2dc]','bg-[#dbe4f0]','bg-[#f0e2c2]'][i % 4]}`}>{i+1}</span><input className="input-paper !min-h-[46px]" aria-label={`Name for person ${i + 1}`} maxLength={30} placeholder={i ? `Friend ${i + 1}` : 'Your name'} value={names[i] ?? ''} onChange={(e) => setNameAt(i,e.target.value)} /></label>)}</div>
        </div>}
        {step === 2 && <div><h1 className="serif text-4xl sm:text-5xl">Choose the feeling.</h1><p className="mb-7 mt-2 text-[#6f685f]">Try each frame and layout before you begin.</p>
          <div className="mb-3 flex min-h-[320px] items-center justify-center px-2 py-4" aria-label={`Preview of ${count} ${count === 1 ? 'person' : 'people'} with ${photosPerPerson} ${photosPerPerson === 1 ? 'photo' : 'photos'} each`}>
            <div style={{ width: fittedFrameWidth(layout, count, photosPerPerson, 'min(38dvh, 330px)') }}><FramePreview photos={previewPhotos} people={count} photosPerPerson={photosPerPerson} layout={layout} frameType={frameType} frameColor={frameColor} showDate={false} /></div>
          </div>
          <p className="mb-6 text-center text-xs text-[#756f66]">{count} {count === 1 ? 'person' : 'people'} · {photosPerPerson} {photosPerPerson === 1 ? 'photo' : 'photos'} each · {layouts.find(([key]) => key === layout)?.[1]}</p>
          <div className="mt-7"><span className="field-label">Arrange the frames</span><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{layouts.map(([key,label]) => <button key={key} aria-pressed={layout === key} onClick={() => setLayout(key)} className={`min-h-12 rounded-xl border px-3 text-sm ${layout === key ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{label}</button>)}</div></div>
          <div className="mt-7"><span className="field-label">Choose a frame</span><FrameTypePicker value={frameType} onChange={setFrameType} layout={layout} people={count} photosPerPerson={photosPerPerson} photos={previewPhotos} /></div>
        </div>}
        {step === 3 && <div><h1 className="serif text-4xl sm:text-5xl">Set the moment.</h1><p className="mb-7 mt-2 text-[#6f685f]">A tiny prompt helps everyone feel part of the same picture.</p>
          <label className="field-label" htmlFor="prompt">Today's prompt</label><textarea id="prompt" data-testid="input-prompt" className="input-paper mb-6 min-h-24 resize-y" maxLength={120} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <span className="field-label">Camera countdown</span><div className="mb-6 flex gap-2">{([3,5,10] as const).map((seconds) => <button key={seconds} aria-pressed={countdownSeconds === seconds} onClick={() => setCountdownSeconds(seconds)} className={`min-h-11 rounded-full border px-5 ${countdownSeconds === seconds ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{seconds} seconds</button>)}</div>
          <p className="mt-6 flex items-center gap-2 text-sm text-[#6f685f]"><LockGlyph /> The photobooth opens when everyone has finished their photos.</p>
        </div>}
        {createBooth.isError && <div className="mt-5"><ErrorNote message={getError(createBooth.error)} /></div>}
        {claimSlot.isError && <div className="mt-5"><ErrorNote message={getError(claimSlot.error)} /></div>}
        {setupError && <div className="mt-5"><ErrorNote message={setupError} /></div>}
        <div className="mt-8 flex justify-center">{step < 3 ? <Button disabled={step === 1 && (!name.trim() || !names[0]?.trim())} onClick={() => setStep(step+1)}>Continue <ArrowRight size={17} /></Button> : <Button disabled={createBooth.isPending || claimSlot.isPending || savingFrame || !name.trim() || !names[0]?.trim()} onClick={submit}>{createBooth.isPending || claimSlot.isPending || savingFrame ? <LoaderCircle className="animate-spin" /> : <Sparkles size={17} />} {createdBooth ? 'Retry frame setup' : 'Create private booth'}</Button>}</div>
      </Panel>
    </div>
  </Shell>;
}

function BoothLoading({ error, retry }: { error?: unknown; retry?: () => void }) {
  return error ? <ErrorNote message={getError(error)} onRetry={retry} /> : <LoadingCard />;
}

export function BoothManagePage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const query = useBooth(privateToken);
  const booth = query.data;
  const creatorToken = localStorage.getItem(creatorKey(privateToken));
  const personCount = booth ? Math.ceil(booth.slots.length / (booth.photosPerPerson || 1)) : 0;
  const finalizedPeople = booth ? Array.from({ length: personCount }, (_, index) => booth.slots.slice(index * (booth.photosPerPerson || 1), (index + 1) * (booth.photosPerPerson || 1))).filter((group) => group.every((slot) => slot.claimStatus === 'submitted')).length : 0;
  const deleteBooth = useDeleteBooth({ request: { headers: { 'X-Creator-Token': creatorToken ?? '' } } });
  const inviteUrl = `${location.origin}/join/${privateToken}`;
  const deleteIt = () => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/booth/${privateToken}`)}`); return; }
    if (!creatorToken || !window.confirm('Delete this booth and all of its frames? This cannot be undone.')) return;
    deleteBooth.mutate({ privateToken }, { onSuccess: () => {
      localStorage.removeItem(creatorKey(privateToken));
      if (localStorage.getItem(activeBoothKey) === privateToken) localStorage.removeItem(activeBoothKey);
      Object.keys(localStorage).filter((key) => key.startsWith(participantPrefix(privateToken)) || key.startsWith(`tc-confirmed:${privateToken}:`)).forEach((key) => localStorage.removeItem(key));
      navigate('/');
    } });
  };
  return <Shell><div className="mx-auto max-w-[820px] py-8 sm:py-12">
    <button onClick={() => navigate('/')} className="button-quiet mb-6 inline-flex items-center gap-2 !px-0"><ArrowLeft size={16} /> Home</button>
    {query.isLoading || !booth ? <BoothLoading error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="mb-7"><p className="eyebrow">A little place for your people</p><h1 className="serif mt-2 text-5xl sm:text-6xl">{booth.name}</h1>{booth.subtitle && <p className="mt-2 text-[#6f685f]">{booth.subtitle}</p>}</div>
      {booth.revealAvailable ? <div className="mb-7 rounded-2xl border border-[#c2d9cf] bg-[#e6f0eb] p-5 text-center"><strong className="serif text-2xl">Everyone’s done. Your photobooth is ready.</strong><p className="mt-1 text-sm text-[#586d63]">The frames are together at last.</p><Button className="mt-4" onClick={() => navigate(`/booth/${privateToken}/reveal`)}>View final photobooth <ArrowRight size={17} /></Button></div> : <div className="mb-7"><h2 className="serif text-3xl">{finalizedPeople === 0 ? 'The first person is still to come.' : `${personCount - finalizedPeople} ${personCount - finalizedPeople === 1 ? 'person' : 'people'} left to finalize.`}</h2><p className="mt-1 text-[#6f685f]">Photos stay tucked away until everyone is in.</p></div>}
      <Panel><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><span className="eyebrow">The little roll call</span><p className="mb-0 mt-1 font-semibold">{finalizedPeople} of {personCount} people finalized</p></div><ProgressDots total={personCount} complete={finalizedPeople} noun="people" /></div><SlotList slots={booth.slots} photosPerPerson={booth.photosPerPerson} /><div className="mt-6 flex flex-wrap gap-3"><CopyButton text={inviteUrl}><Link2 size={16} /> Copy invitation link</CopyButton><Button variant="secondary" onClick={() => { const text = `A photobooth for us: ${inviteUrl}`; if (navigator.share) void navigator.share({ title: booth.name, text, url: inviteUrl }); else void navigator.clipboard.writeText(text); }}><Share2 size={16} /> Share invite</Button><Button variant="quiet" onClick={() => navigate(`/booth/${privateToken}/notifications`)}>Gentle reminders</Button></div></Panel>
      {creatorToken && <div className="mt-4 flex flex-wrap gap-2"><Button variant="quiet" disabled={deleteBooth.isPending} onClick={deleteIt}><Trash2 size={16} /> Delete booth</Button></div>}
      {deleteBooth.isError && <div className="mt-4"><ErrorNote message={getError(deleteBooth.error)} /></div>}
    </>}
  </div></Shell>;
}

export function JoinPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useBooth(privateToken);
  const claim = useClaimBoothSlot();
  const [displayName, setDisplayName] = useState('');
  const [slotId, setSlotId] = useState(() => new URLSearchParams(location.search).get('slot') ?? '');
  const booth = query.data;
  const selectable = booth?.slots.filter((slot) => slot.claimStatus === 'open' && slot.position % (booth.photosPerPerson ?? 1) === 0) ?? [];
  const selectedSlot = selectable.find((slot) => slot.id === slotId) ?? selectable[0];
  const assignedName = selectedSlot?.displayName.trim() ?? '';
  const claimDisplayName = assignedName || displayName;
  const submit = async () => {
    if (!user) {
      const destination = `/join/${privateToken}?slot=${encodeURIComponent(selectedSlot?.id ?? '')}`;
      navigate(`/login?next=${encodeURIComponent(destination)}`);
      return;
    }
    const data: SlotClaimInput = { displayName: claimDisplayName.trim(), slotId: selectedSlot?.id ?? null };
    claim.mutate({ privateToken, data }, { onSuccess: async (result) => {
      localStorage.setItem(participantKey(privateToken, result.slotId), result.participantToken);
      // For multi-photo: refetch booth to discover all claimed sibling slots
      try {
        await queryClient.invalidateQueries({ queryKey: getGetBoothQueryKey(privateToken) });
        const updated = queryClient.getQueryData<BoothState>(getGetBoothQueryKey(privateToken));
        if (updated) {
          const claimed = updated.slots.find((s) => s.id === result.slotId);
          const groupSize = updated.photosPerPerson ?? 1;
          const groupStart = claimed ? Math.floor(claimed.position / groupSize) * groupSize : -1;
          const siblings = updated.slots.filter((s) => s.position >= groupStart && s.position < groupStart + groupSize && s.claimStatus === 'claimed' && s.id !== result.slotId);
          for (const sib of siblings) localStorage.setItem(participantKey(privateToken, sib.id), result.participantToken);
        }
      } catch { /* non-fatal: single-photo flow still works */ }
      navigate(`/join/${privateToken}/capture?slot=${encodeURIComponent(result.slotId)}`);
    } });
  };
  return <Shell><div className="mx-auto max-w-[620px] py-9 sm:py-14">
    {query.isLoading || !booth ? <BoothLoading error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="rounded-[28px] bg-[#292723] px-6 py-8 text-center text-[#fffdf8] sm:px-10"><p className="eyebrow text-[#cfc8be]">{booth.occasion || 'A private photobooth'}</p><h1 className="serif mt-3 text-4xl sm:text-5xl">{booth.name}</h1>{booth.subtitle && <p className="mb-0 mt-3 text-[#ded7ce]">{booth.subtitle}</p>}<p className="mb-0 mt-5 text-xs text-[#cfc8be]">{booth.participantCount} FRAMES · ABOUT A MINUTE EACH</p></div>
      <Panel className="mt-5"><span className="eyebrow">A little prompt</span><blockquote className="serif mb-0 mt-2 rounded-2xl bg-[#f1e5dc] p-5 text-2xl">{booth.prompt || defaultPrompt}</blockquote>
        {booth.revealAvailable ? <div className="mt-5 rounded-xl bg-[#e6f0eb] p-4 text-sm">This booth is ready to open. <button className="underline" onClick={() => navigate(`/booth/${privateToken}/reveal`)}>See the finished keepsake</button></div> : <>
          <h2 className="serif mb-1 mt-7 text-3xl">Choose your spot.</h2><p className="mb-5 text-sm text-[#6f685f]">Sign in to add your {booth.photosPerPerson === 1 ? 'photo' : `${booth.photosPerPerson} photos`}. Your photos stay private until everyone’s ready.</p>
          {selectable.length === 0 ? <div className="rounded-xl border border-dashed border-[#cfc5b7] p-5 text-center text-sm text-[#6f685f]">All the frames have been claimed. Ask the booth maker to share an open spot.</div> : <>
            <label className="field-label" htmlFor="invite-slot">Pick your name</label><select id="invite-slot" className="input-paper mb-2" value={selectedSlot?.id ?? ''} onChange={(e) => setSlotId(e.target.value)}>{selectable.map((slot) => <option key={slot.id} value={slot.id}>{slot.displayName || `Person ${Math.floor(slot.position / (booth.photosPerPerson ?? 1)) + 1}`}</option>)}</select>
            {assignedName ? <p className="mb-4 text-sm text-[#6f685f]">This frame is labeled <strong>{assignedName}</strong>.</p> : <><label className="field-label" htmlFor="invite-name">Your name</label><input id="invite-name" data-testid="input-participant-name" className="input-paper mb-4" maxLength={30} placeholder="What should we call you?" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></>}
            <div className="flex items-center gap-2 text-xs text-[#6f685f]"><LockGlyph /> Your frame is hidden from the group until all are confirmed.</div>
            {claim.isError && <div className="mt-4"><ErrorNote message={getError(claim.error)} /></div>}
            <Button className="mt-5 w-full" disabled={(Boolean(user) && !claimDisplayName.trim()) || claim.isPending} onClick={submit}>{claim.isPending ? <LoaderCircle className="animate-spin" /> : null} {user ? 'Claim this frame' : 'Sign in to claim this frame'} <ArrowRight size={17} /></Button>
          </>}
        </>}
      </Panel>
    </>}
  </div></Shell>;
}

export function CapturePage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(location.search);
  const slotId = params.get('slot') || '';
  const token = slotId ? localStorage.getItem(participantKey(privateToken, slotId)) : null;
  const boothQuery = useBooth(privateToken);
  const participantToken = token ?? '';
  // Slots for this participant remain in the list after each upload so the
  // current frame does not shift when the booth query refreshes.
  const mySlots = useMemo(() => {
    if (!boothQuery.data) return [];
    const selected = boothQuery.data.slots.find((s) => s.id === slotId);
    if (!selected) return [];
    const groupSize = boothQuery.data.photosPerPerson ?? 1;
    const groupStart = Math.floor(selected.position / groupSize) * groupSize;
    return boothQuery.data.slots.filter((s) => s.position >= groupStart && s.position < groupStart + groupSize);
  }, [boothQuery.data, slotId]);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [showTrayOverview, setShowTrayOverview] = useState(false);
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});
  const nextPhotoIndex = mySlots.findIndex((s) => s.claimStatus === 'claimed');
  const currentPhotoIndex = reviewIndex ?? (nextPhotoIndex >= 0 ? nextPhotoIndex : 0);
  const currentSlotId = mySlots[currentPhotoIndex]?.id ?? slotId;
  const slot = boothQuery.data?.slots.find((s) => s.id === currentSlotId);
  const totalPhotos = mySlots.length || 1;
  const allMySlotsSubmitted = mySlots.length > 0 && mySlots.every((s) => s.claimStatus === 'submitted');
  const allMySlotsSaved = mySlots.length > 0 && mySlots.every((s) => s.claimStatus === 'staged' || s.claimStatus === 'submitted');
  const savedCount = mySlots.filter((s) => s.claimStatus === 'staged' || s.claimStatus === 'submitted').length;
  const privatePhotoIds = mySlots.filter((s) => s.claimStatus === 'staged').map((s) => s.id).join(',');
  const requestUpload = useRequestFrameUpload({ request: { headers: { 'X-Participant-Token': participantToken } } });
  const confirmFrame = useConfirmBoothFrame({ request: { headers: { 'X-Participant-Token': participantToken } } });
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [streamError, setStreamError] = useState('');
  const [facing, setFacing] = useState<'user'|'environment'>('user');
  const [preview, setPreview] = useState('');
  const [candidate, setCandidate] = useState<File | null>(null);
  const [source, setSource] = useState<'camera'|'upload'>('camera');
  const [mirror, setMirror] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!privatePhotoIds || !participantToken) { setSavedUrls({}); return; }
    const controller = new AbortController();
    const urls: Record<string, string> = {};
    void Promise.all(privatePhotoIds.split(',').map(async (id) => {
      const response = await fetch(`/api/booths/${privateToken}/slots/${id}/draft-photo`, {
        headers: { 'X-Participant-Token': participantToken }, signal: controller.signal,
      });
      if (!response.ok) throw new Error('A saved photo could not be loaded.');
      const blob = await response.blob();
      if (!controller.signal.aborted) urls[id] = URL.createObjectURL(blob);
    })).then(() => { if (!controller.signal.aborted) setSavedUrls(urls); }).catch(() => {
      if (!controller.signal.aborted) setError('A saved photo could not be loaded. Try refreshing this page.');
    });
    return () => { controller.abort(); Object.values(urls).forEach((url) => URL.revokeObjectURL(url)); };
  }, [privatePhotoIds, participantToken, privateToken]);
  const cameraStart = useCallback(async () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (!navigator.mediaDevices?.getUserMedia) { setStreamError('Camera access is unavailable here. You can choose a photo instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1600 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStreamError('');
    } catch { setStreamError('Camera permission was not available. Choose a photo from your device instead.'); }
  }, [facing]);
  const cameraActive = Boolean(participantToken && slotId && boothQuery.data && !allMySlotsSaved && !preview && reviewIndex === null && !showTrayOverview);
  useEffect(() => {
    if (!cameraActive) return;
    void cameraStart();
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, [cameraStart, cameraActive]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (allMySlotsSubmitted && !isSaving && !isFinalizing) navigate(`/booth/${privateToken}`, { replace: true });
  }, [allMySlotsSubmitted, isSaving, isFinalizing, navigate, privateToken]);
  const capture = () => {
    if (countdown !== null) return;
    let n = boothQuery.data?.countdownSeconds ?? 5;
    setCountdown(n);
    const timer = window.setInterval(() => {
      n -= 1;
      if (n <= 0) {
        window.clearInterval(timer);
        const video = videoRef.current;
        if (!video || video.readyState < 2) { setCountdown(null); setStreamError('Camera is still warming up. Try again or pick a photo.'); return; }
        setFlash(true);
        window.setTimeout(() => setFlash(false), 500);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) { if (mirror) { ctx.translate(canvas.width,0); ctx.scale(-1,1); } ctx.drawImage(video,0,0); }
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `timecapsule-${Date.now()}.jpg`, { type: 'image/jpeg' });
          setCandidate(file); setPreview(URL.createObjectURL(file)); setSource('camera'); setCountdown(null);
        }, 'image/jpeg', .92);
      } else setCountdown(n);
    }, 1000);
  };
  const chooseFile = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setError('Choose a JPG, PNG, or WebP photo.'); return; }
    if (file.size > 12_000_000) { setError('This photo is larger than 12 MB. Choose a smaller one.'); return; }
    if (preview) URL.revokeObjectURL(preview);
    setCandidate(file); setPreview(URL.createObjectURL(file)); setSource('upload'); setError('');
  };
  const retake = () => { if (preview) URL.revokeObjectURL(preview); setPreview(''); setCandidate(null); setError(''); };
  const confirm = async () => {
    if (!candidate || !currentSlotId || !participantToken) return;
    setError('');
    setIsSaving(true);
    try {
      const data: FrameUploadInput = { name: candidate.name.slice(0,180), size: candidate.size, contentType: candidate.type as FrameUploadInput['contentType'] };
      const destination = await requestUpload.mutateAsync({ privateToken, slotId: currentSlotId, data });
      const put = await fetch(destination.uploadURL, { method: 'PUT', headers: { 'Content-Type': candidate.type }, body: candidate });
      if (!put.ok) throw new Error('The secure upload did not finish. Please try again.');
      const dimensions = await new Promise<{width:number;height:number}>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('We could not read the selected photo.'));
        image.src = preview;
      });
      const confirmData: FrameConfirmInput = { objectPath: destination.objectPath, ...dimensions, captureSource: source };
      const confirmedState = await confirmFrame.mutateAsync({ privateToken, slotId: currentSlotId, data: confirmData });
      queryClient.setQueryData(getGetBoothQueryKey(privateToken), confirmedState);
      void queryClient.invalidateQueries({ queryKey: getGetBoothQueryKey(privateToken) });
      if (totalPhotos > 1) {
        if (preview) URL.revokeObjectURL(preview);
        setPreview(''); setCandidate(null); setError('');
        setReviewIndex(null);
        setShowTrayOverview(false);
        setIsSaving(false);
        return;
      }
      localStorage.setItem(confirmedKey(privateToken, currentSlotId), 'true');
      navigate(`/booth/${privateToken}`);
    } catch (reason) { setError(getError(reason)); setIsSaving(false); }
  };
  const removeSaved = async (index: number, retakeNow: boolean) => {
    const savedSlot = mySlots[index];
    if (!savedSlot || savedSlot.claimStatus !== 'staged') return;
    setError(''); setIsRemoving(true);
    try {
      const response = await fetch(`/api/booths/${privateToken}/slots/${savedSlot.id}/draft-photo`, {
        method: 'DELETE', headers: { 'X-Participant-Token': participantToken },
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'The photo could not be removed.');
      await queryClient.invalidateQueries({ queryKey: getGetBoothQueryKey(privateToken) });
      setReviewIndex(null);
      setShowTrayOverview(!retakeNow);
    } catch (reason) { setError(getError(reason)); }
    finally { setIsRemoving(false); }
  };
  const finalizePhotos = async () => {
    if (!allMySlotsSaved || !slotId) return;
    setError(''); setIsFinalizing(true);
    try {
      const response = await fetch(`/api/booths/${privateToken}/slots/${slotId}/finalize`, {
        method: 'POST', headers: { 'X-Participant-Token': participantToken },
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'Your photos could not be finalized.');
      const state = await response.json() as BoothState;
      queryClient.setQueryData(getGetBoothQueryKey(privateToken), state);
      localStorage.setItem(confirmedKey(privateToken, slotId), 'true');
      navigate(`/booth/${privateToken}`);
    } catch (reason) { setError(getError(reason)); setIsFinalizing(false); }
  };
  if (!slotId || !token) return <Shell><div className="mx-auto max-w-lg py-12"><Panel><h1 className="serif text-3xl">Your frame link is needed.</h1><p className="text-[#6f685f]">Open the invitation and claim an available frame first. Your participant key is kept on this device.</p><a href={`/join/${privateToken}`} className="button-primary mt-4 inline-flex items-center no-underline">Back to invitation</a></Panel></div></Shell>;
  if (boothQuery.isLoading) return <Shell><div className="mx-auto max-w-lg py-12"><LoadingCard /></div></Shell>;
  if (allMySlotsSubmitted && !isSaving) return <Shell><div className="mx-auto max-w-lg py-12"><LoadingCard /></div></Shell>;
  const photoBusy = isSaving || isRemoving || isFinalizing;
  return <main className="min-h-[100dvh] bg-[#292723] px-4 pb-10 pt-5 text-[#fffdf8]">
    {flash && <div className="camera-flash pointer-events-none fixed inset-0 z-[100] bg-white" aria-hidden="true" />}
    <p className="mb-4 text-center text-xs text-[#cfc8be]">{slot?.displayName || 'Your frame'}{totalPhotos > 1 && (allMySlotsSaved && reviewIndex === null ? ' · Ready to finish' : ` · Photo ${currentPhotoIndex + 1} of ${totalPhotos}`)}</p>
    <div className={`mx-auto grid w-full items-start gap-6 ${totalPhotos > 1 ? 'max-w-[900px] md:grid-cols-[minmax(0,600px)_minmax(180px,240px)]' : 'max-w-[600px]'}`}>
    <div className="min-w-0">
    {reviewIndex !== null && mySlots[reviewIndex]?.claimStatus === 'staged' ? <div className="mx-auto max-w-[600px]">
      <div className="mb-5 text-center"><p className="eyebrow text-[#e8a99c]">Saved photo {reviewIndex + 1} of {totalPhotos}</p><h1 className="serif mb-1 mt-2 text-4xl">Keep this moment?</h1><p className="mb-0 text-sm text-[#d1c9be]">Only you can see it while you finish your photos.</p></div>
      <div className="relative mx-auto aspect-[4/5] max-h-[42dvh] overflow-hidden rounded-[26px] bg-[#47433d] sm:max-h-[58dvh]">{savedUrls[mySlots[reviewIndex].id] ? <img src={savedUrls[mySlots[reviewIndex].id]} alt={`Saved photo ${reviewIndex + 1}`} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><LoaderCircle className="animate-spin" /></div>}</div>
      <div className="mx-auto mt-5 flex max-w-[520px] flex-wrap justify-center gap-3"><Button variant="secondary" onClick={() => { setReviewIndex(null); setShowTrayOverview(true); }} disabled={photoBusy}>Back to photos</Button><Button variant="secondary" onClick={() => void removeSaved(reviewIndex, true)} disabled={photoBusy}>{isRemoving ? <LoaderCircle className="animate-spin" /> : <Camera size={17} />} Retake</Button><Button variant="quiet" className="!text-[#f2bdb0]" onClick={() => void removeSaved(reviewIndex, false)} disabled={photoBusy}><Trash2 size={17} /> Delete</Button></div>
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
    </div> : (allMySlotsSaved || showTrayOverview) && !preview ? <div className="mx-auto max-w-[600px] py-5 text-center">
      <p className="eyebrow text-[#e8a99c]">Your little camera roll</p><h1 className="serif mt-2 text-4xl">{allMySlotsSaved ? 'All your photos are saved.' : 'Your photos so far.'}</h1><p className="mx-auto mt-3 max-w-md text-sm text-[#d1c9be]">Tap a photo below to revisit it. {allMySlotsSaved ? 'When they feel right, finish your set.' : 'Add the missing photos when you’re ready.'}</p>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">{mySlots.map((item, index) => <button key={item.id} type="button" className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/20 bg-[#47433d]" onClick={() => { if (item.claimStatus === 'staged') { setReviewIndex(index); setShowTrayOverview(false); } else if (item.claimStatus === 'claimed') setShowTrayOverview(false); }} disabled={photoBusy}><span className="absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2 py-1 text-xs">{index + 1}</span>{savedUrls[item.id] ? <img src={savedUrls[item.id]} alt={`Saved photo ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" /> : <span className="grid h-full place-items-center text-sm text-[#d1c9be]">{item.claimStatus === 'claimed' ? 'Add photo' : item.claimStatus === 'submitted' ? 'Finalized' : 'Loading…'}</span>}</button>)}</div>
      {allMySlotsSaved ? <Button className="mt-8 w-full max-w-[460px] bg-[#E5786A] !text-[#fffdf8] hover:bg-[#d96b5d]" disabled={photoBusy} onClick={() => void finalizePhotos()}>{isFinalizing ? <><LoaderCircle className="animate-spin" /> Finalizing…</> : <>Finish my photos <Check size={17} /></>}</Button> : <Button className="mt-8" onClick={() => setShowTrayOverview(false)}>Take the next photo <Camera size={17} /></Button>}
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
    </div> : !preview ? <div className="mx-auto max-w-[600px]">
      <div className="mb-4 text-center"><h1 className="serif mb-1 text-4xl">Find your frame.</h1><p className="mb-0 text-sm text-[#d1c9be]">{boothQuery.data?.prompt || defaultPrompt}</p></div>
      <div className={`camera-stage relative mx-auto aspect-[4/5] overflow-hidden rounded-[28px] border border-[#59554f] bg-[#3d3a35] ${totalPhotos > 1 ? 'max-h-[40dvh] sm:max-h-[68dvh]' : 'max-h-[68dvh]'}`}>
        <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`} />
        <div className="pointer-events-none absolute inset-[7%] rounded-[22px] border border-dashed border-white/70" />
        <div className="absolute left-1/2 top-4 max-w-[90%] -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-center text-xs">{boothQuery.data?.prompt || defaultPrompt}</div>
        {countdown !== null && <div className="absolute inset-0 grid place-items-center bg-black/20"><span className="serif text-[8rem] leading-none text-white drop-shadow-lg">{countdown}</span></div>}
        {streamError && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 p-3 text-center text-sm">{streamError}</div>}
      </div>
      <div className="mt-5 flex items-center justify-center gap-8"><button aria-label="Choose photo from device" className="grid size-12 place-items-center rounded-full bg-white/10" onClick={() => fileRef.current?.click()}><Image size={19} /></button><button aria-label="Take photo" className="grid size-[76px] place-items-center rounded-full border-[5px] border-white bg-transparent" onClick={capture} disabled={countdown !== null}><span className="size-[54px] rounded-full bg-white" /></button><button aria-label="Switch camera" className="grid size-12 place-items-center rounded-full bg-white/10" onClick={() => setFacing((value) => value === 'user' ? 'environment' : 'user')}><Camera size={19} /></button></div>
      <div className="mt-4 flex flex-wrap justify-center gap-3"><Button variant="quiet" className="!text-[#d1c9be]" onClick={() => setMirror((v) => !v)}>Mirror: {mirror ? 'on' : 'off'}</Button><Button variant="quiet" className="!text-[#d1c9be]" onClick={() => fileRef.current?.click()}>Choose a photo</Button></div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { chooseFile(e.target.files?.[0]); e.target.value = ''; }} />
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
      <p className="mt-4 text-center text-xs text-[#bdb6ad]">{totalPhotos > 1 ? 'Each photo goes to your private camera roll when you save it.' : 'Your photo isn’t uploaded until you confirm it.'}</p>
    </div> : <div className="mx-auto max-w-[600px]"><h1 className="serif mb-1 text-center text-4xl">Keep this one?</h1><p className="mb-5 text-center text-sm text-[#d1c9be]">Nothing is shared until you confirm.</p>
      <div className={`relative mx-auto aspect-[4/5] overflow-hidden rounded-[26px] bg-[#47433d] ${totalPhotos > 1 ? 'max-h-[40dvh] sm:max-h-[66dvh]' : 'max-h-[66dvh]'}`}><img src={preview} alt="Your photo preview" className="h-full w-full object-cover" style={{ transform: mirror && source === 'camera' ? 'scaleX(-1)' : undefined }} /></div>
      <div className="mx-auto mt-5 flex max-w-[460px] gap-3"><Button variant="secondary" className="flex-1" onClick={retake} disabled={photoBusy}>Retake</Button><Button variant="secondary" className="flex-1" onClick={() => setMirror((v) => !v)}>Mirror: {mirror ? 'on' : 'off'}</Button></div>
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
      <div className="sticky bottom-0 left-0 right-0 flex flex-col items-center bg-gradient-to-t from-[#292723] via-[#292723] to-transparent pb-4 pt-6">
        <Button className="w-full max-w-[460px] bg-[#E5786A] !text-[#fffdf8] shadow-lg shadow-[#E5786A]/30 hover:bg-[#d96b5d]" disabled={photoBusy} onClick={() => void confirm()}>{photoBusy ? <><LoaderCircle className="animate-spin" /> Saving privately…</> : <>{totalPhotos > 1 ? 'Save to my photos' : 'Use this photo'} <Check size={17} /></>}</Button>
        <p className="mt-2 text-center text-xs text-[#bdb6ad]">{totalPhotos > 1 ? 'You can review or retake it before finishing your set.' : 'Visible only after every frame is confirmed.'}</p>
      </div>
    </div>}
    <div className="mt-5 text-center"><a href={`/join/${privateToken}`} className="text-sm text-[#ded7ce] underline underline-offset-4">Back to invitation</a></div>
    </div>
    {totalPhotos > 1 && <section className="min-w-0 rounded-[24px] border border-white/20 bg-[#383530] px-4 py-3 shadow-xl shadow-black/20 md:sticky md:top-5 md:max-h-[calc(100dvh-40px)] md:overflow-y-auto" aria-label="Saved photos"><div className="mb-2 flex items-center justify-between gap-3"><div><p className="eyebrow mb-1 text-[#e8a99c]">Camera roll</p><p className="m-0 text-xs text-[#d1c9be]">{savedCount} of {totalPhotos} saved · tap to review</p></div>{savedCount > 0 && !allMySlotsSaved && <button type="button" className="text-xs text-[#e8a99c] underline underline-offset-4" onClick={() => { if (preview) retake(); setShowTrayOverview(true); }}>View all</button>}</div><div className="flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-2 md:overflow-visible">{mySlots.map((item, index) => <button key={item.id} type="button" aria-label={item.claimStatus === 'staged' ? `Review saved photo ${index + 1}` : item.claimStatus === 'submitted' ? `Photo ${index + 1} finalized` : `Take photo ${index + 1}`} aria-pressed={reviewIndex === index} className={`relative aspect-[4/5] w-[60px] shrink-0 overflow-hidden rounded-xl border-2 bg-[#47433d] sm:w-[76px] ${reviewIndex === index ? 'border-[#E5786A]' : 'border-white/25'}`} disabled={photoBusy || item.claimStatus === 'submitted'} onClick={() => { if (preview) retake(); setError(''); if (item.claimStatus === 'staged') { setReviewIndex(index); setShowTrayOverview(false); } else { setReviewIndex(null); setShowTrayOverview(false); } }}><span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-black/65 px-1.5 py-0.5 text-[10px]">{index + 1}</span>{savedUrls[item.id] ? <img src={savedUrls[item.id]} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center text-[11px] text-[#d1c9be]">{item.claimStatus === 'claimed' ? '+' : item.claimStatus === 'submitted' ? '✓' : '…'}</span>}</button>)}</div></section>}
    </div>
  </main>;
}

export function RevealPage() {
  const { privateToken = '', boothId = '' } = useParams<{privateToken:string;boothId:string}>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const query = useBooth(privateToken);
  const { entries: archived, isLoading: archiveLoading, error: archiveError } = useArchiveBooths();
  const [skip, setSkip] = useState(false);
  const [replay, setReplay] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const booth = query.data ?? archived.find((entry) => entry.id === boothId)?.booth;
  const photos = useMemo(() => booth?.slots.map((slot) => slot.photoUrl).filter((url): url is string => Boolean(url)) ?? [], [booth?.slots]);
  const exportArtifact = async () => {
    if (!booth) return;
    const canvas = document.createElement('canvas');
    const layout = booth.customization.layout || booth.layout;
    const frame = getFrameLayout(layout, booth.participantCount, booth.photosPerPerson);
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = booth.customization.frameColor || '#fffdf8';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    const filterByName: Record<string,string> = { 'soft-bw':'grayscale(.78) contrast(.96)', 'high-contrast':'contrast(1.18) saturate(.8)', 'warm-film':'sepia(.26) saturate(1.08)', 'cool-flash':'saturate(.82) hue-rotate(8deg) brightness(1.04)', faded:'saturate(.62) brightness(1.08) contrast(.9)', disposable:'saturate(1.16) contrast(1.08)', sepia:'sepia(.68) saturate(.82)', grain:'contrast(1.07) saturate(.9)', original:'none' };
    const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    });
    for (const slot of [...frame.slots].sort((a, b) => a.z - b.z)) {
      const i = photoIndexForSlot(slot, booth.photosPerPerson);
      const photo = booth.slots[i]?.photoUrl;
      const image = photo ? await loadImage(photo) : null;
      ctx.save();
      ctx.translate(slot.cx, slot.cy);
      ctx.rotate(slot.rotation * Math.PI / 180);
      ctx.beginPath();
      ctx.rect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
      ctx.clip();
      ctx.fillStyle = ['#9fb9c7','#e6c4b5','#c6d9b8','#b8c8e6'][i % 4];
      ctx.fillRect(-slot.w / 2, -slot.h / 2, slot.w, slot.h);
      if (image) {
        const adj = booth.customization.slotAdjustments?.find((a: { slotIndex: number }) => a.slotIndex === i);
        const scale = adj?.scale ?? 1;
        const baseCropW = Math.min(image.naturalWidth, image.naturalHeight * slot.w / slot.h);
        const baseCropH = Math.min(image.naturalHeight, image.naturalWidth * slot.h / slot.w);
        const cropW = baseCropW / scale;
        const cropH = baseCropH / scale;
        const sourceX = Math.max(0, Math.min(image.naturalWidth - cropW, (image.naturalWidth - cropW) / 2 - (adj?.panX ?? 0) * (image.naturalWidth - cropW) / 2));
        const sourceY = Math.max(0, Math.min(image.naturalHeight - cropH, (image.naturalHeight - cropH) / 2 - (adj?.panY ?? 0) * (image.naturalHeight - cropH) / 2));
        ctx.filter = filterByName[booth.customization.filter] || 'none';
        ctx.drawImage(image, sourceX, sourceY, cropW, cropH, -slot.w / 2, -slot.h / 2, slot.w, slot.h);
      }
      ctx.restore();
    }
    const overlay = await loadImage(frameAssetUrl(frame));
    if (overlay) {
      ctx.save();
      ctx.filter = frameOverlayFilter(booth.customization.frameType) || 'none';
      ctx.drawImage(overlay, 0, 0, frame.width, frame.height);
      ctx.restore();
      const treatment = booth.customization.frameType;
      if (['solid', 'pattern', 'seasonal'].includes(treatment) || (treatment === 'clean' && booth.customization.frameColor.toLowerCase() !== '#fffdf8')) {
        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = frame.width; tintCanvas.height = frame.height;
        const tint = tintCanvas.getContext('2d');
        if (tint) {
          if (treatment === 'seasonal') {
            for (let x = 15; x < frame.width; x += 45) for (let y = 20; y < frame.height; y += 45) { tint.fillStyle = (x + y) % 2 ? '#d36d63' : '#6c9b81'; tint.beginPath(); tint.arc(x, y, 2.5, 0, Math.PI * 2); tint.fill(); }
            tint.globalCompositeOperation = 'destination-in'; tint.drawImage(overlay, 0, 0, frame.width, frame.height);
          } else {
            tint.drawImage(overlay, 0, 0, frame.width, frame.height);
            tint.globalCompositeOperation = 'source-in';
            tint.fillStyle = treatment === 'pattern' ? 'rgba(255,253,248,.25)' : booth.customization.frameColor;
            tint.fillRect(0, 0, frame.width, frame.height);
            if (treatment === 'pattern') { tint.strokeStyle = 'rgba(229,120,106,.2)'; tint.lineWidth = 7; for (let x = -frame.height; x < frame.width + frame.height; x += 17) { tint.beginPath(); tint.moveTo(x, 0); tint.lineTo(x + frame.height, frame.height); tint.stroke(); } }
          }
          ctx.save();
          if (treatment === 'clean') { ctx.globalAlpha = .65; ctx.globalCompositeOperation = 'multiply'; }
          ctx.drawImage(tintCanvas, 0, 0);
          ctx.restore();
        }
      }
    }
    ctx.fillStyle = ['black', 'film', 'film-noir'].includes(booth.customization.frameType) ? '#fffdf8' : '#292723';
    ctx.textAlign = 'center';
    ctx.font = booth.customization.captionFont === 'handwritten' ? '42px Caveat' : booth.customization.captionFont === 'sans' ? '32px Inter' : 'italic 38px Georgia';
    if (booth.customization.caption) ctx.fillText(booth.customization.caption, frame.width / 2, booth.customization.captionPosition === 'top' ? 55 : frame.height - 55, frame.width * .82);
    if (booth.customization.showDate) { ctx.font = '18px sans-serif'; ctx.fillText(new Date().toLocaleDateString(), frame.width / 2, frame.height - 18); }
    for (const object of booth.customization.objects) {
      ctx.save(); ctx.translate(object.x*frame.width, object.y*frame.height); ctx.rotate(object.rotation*Math.PI/180);
      const stickerSource = object.kind === 'sticker' ? stickerImageMap[object.label] : undefined;
      if (stickerSource) {
        const sticker = new window.Image();
        await new Promise<void>((resolve) => { sticker.onload = () => resolve(); sticker.onerror = () => resolve(); sticker.src = stickerSource; });
        if (sticker.complete && sticker.naturalWidth) ctx.drawImage(sticker, -50, -50, 100, 100);
      } else {
        ctx.fillStyle = object.color; ctx.textAlign = 'center'; ctx.font = object.kind === 'text' ? '30px Georgia' : '48px Georgia'; ctx.fillText(object.label,0,0,650);
      }
      ctx.restore();
    }
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${booth.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-photobooth.png`; link.click(); URL.revokeObjectURL(url); },'image/png');
  };
  if (boothId && !user) return <Shell><div className="mx-auto max-w-[600px] py-12"><Panel><h1 className="serif text-3xl">Sign in to open this keepsake.</h1><p className="mt-2 text-[#756f66]">This photostrip belongs to your account archive.</p><Button onClick={() => navigate(`/login?next=${encodeURIComponent(`/archive/${boothId}/reveal`)}`)}>Sign in</Button></Panel></div></Shell>;
  if ((privateToken ? query.isLoading : archiveLoading) || !booth) return <Shell dark><div className="mx-auto max-w-[700px] py-12"><BoothLoading error={privateToken ? query.error : archiveError} retry={() => privateToken ? void query.refetch() : navigate('/archive')} /></div></Shell>;
  if (!booth.revealAvailable) return <Shell><div className="mx-auto max-w-[660px] py-14"><Panel className="text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f0e4d7]"><LockGlyph /></span><h1 className="serif mt-5 text-4xl">Not quite time yet.</h1><p className="mx-auto max-w-md text-[#6f685f]">The photos stay private until everyone has finished.</p><ProgressDots total={booth.participantCount} complete={booth.completedCount} /><p className="mt-2 text-sm">{booth.completedCount} of {booth.participantCount} ready</p><Button className="mt-4" variant="secondary" onClick={() => navigate(`/booth/${privateToken}`)}>Back to the booth</Button></Panel></div></Shell>;
  return <main className="min-h-[100dvh] overflow-hidden bg-[#292723] px-5 pb-8 pt-5 text-[#fffdf8]">
    <div className="mx-auto max-w-[1200px] text-center">
      <p className="eyebrow text-[#cfc8be]">A moment from everywhere</p>
      <h1 key={`title-${replay}`} className={`serif mt-1 text-3xl sm:text-4xl ${skip ? 'opacity-100' : 'reveal-copy'}`}>{booth.name}</h1>
      {booth.subtitle && <p className={`mt-1 text-sm text-[#d6cfc5] ${skip ? '' : 'reveal-copy'}`}>{booth.subtitle}</p>}
      <div className="reveal-machine mx-auto mt-4" style={{ width: fittedFrameWidth(booth.customization.layout || booth.layout, booth.participantCount, booth.photosPerPerson, 'min(74dvh, 820px)') }}>
        <div className="reveal-machine-head" aria-hidden="true"><span className="reveal-machine-brand">timecapsule</span><span className="reveal-machine-light" /><span className="reveal-machine-slit" /></div>
        <div className="reveal-output keepsake-preview"><div key={`print-${replay}`} className={skip ? '' : 'reveal-print'}><FramePreview photos={photos} layout={booth.customization.layout || booth.layout} people={booth.participantCount} photosPerPerson={booth.photosPerPerson} caption={booth.customization.caption} frameColor={booth.customization.frameColor} filter={booth.customization.filter} frameType={booth.customization.frameType} objects={booth.customization.objects} showDate={booth.customization.showDate} captionPosition={booth.customization.captionPosition} captionFont={booth.customization.captionFont} slotAdjustments={booth.customization.slotAdjustments} stickerImageMap={stickerImageMap} /></div></div>
      </div>
      <div className={`mx-auto mt-5 flex w-full max-w-[960px] flex-wrap items-center justify-center gap-3 text-center ${skip ? '' : 'reveal-copy'}`}>
        <Button className="!bg-[#fffdf8] !text-[#292723]" onClick={() => void exportArtifact()}><Download size={17} /> Download keepsake</Button>
        <Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => { setReplay((v) => v+1); setSkip(false); }}><Sparkles size={16} /> Replay</Button>
        <Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => navigate('/archive')}>Archive</Button>
        {privateToken && <Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => { const url = location.href; if (navigator.share) void navigator.share({ title: booth.name, url }); else { void navigator.clipboard.writeText(url); setShareMessage('Private link copied.'); } }}><Share2 size={16} /> Share link</Button>}
        <Button variant="quiet" className="!text-[#cfc8be]" onClick={() => navigate('/')}>Home</Button>
        {!skip && <Button variant="quiet" className="!text-[#cfc8be]" onClick={() => setSkip(true)}>Skip reveal</Button>}
      </div>
      {shareMessage && <p className="mt-2 text-sm text-[#d6cfc5]" role="status">{shareMessage}</p>}
    </div>
  </main>;
}

const frameTypes: CustomizationInput['frameType'][] = ['clean','black','solid','polaroid','film','torn','pattern','retro','seasonal','whimsical','film-noir'];

function FrameTypePicker({ value, onChange, layout = 'classic-strip', people = 1, photosPerPerson = 2, photos = sampleTemplatePhotos(1, 2), frameColor }: {
  value: CustomizationInput['frameType'];
  onChange: (value: CustomizationInput['frameType']) => void;
  layout?: string;
  people?: number;
  photosPerPerson?: number;
  photos?: string[];
  frameColor?: string;
}) {
  return <div className="frame-type-picker" aria-label="Frame styles">{frameTypes.map((item) => <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)} className={`frame-type-option ${value === item ? 'is-selected' : ''}`}>
    <span className="frame-option-preview"><span className="frame-option-artwork" style={{ width: fittedFrameWidth(layout, people, photosPerPerson, '72px') }}><FramePreview photos={photos} layout={layout} people={people} photosPerPerson={photosPerPerson} frameType={item} frameColor={item === 'solid' && (frameColor ?? '#FFFDF8').toLowerCase() === '#fffdf8' ? '#E5786A' : frameColor ?? '#FFFDF8'} compact showDate={false} /></span></span>
    <span>{item === 'film-noir' ? 'Film Noir' : item}</span>
  </button>)}</div>;
}

export function NotificationsPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const query = useBooth(privateToken);
  const confirmed = new URLSearchParams(location.search).get('confirmed') === '1' || Object.keys(localStorage).some((key) => key.startsWith(`tc-confirmed:${privateToken}:`) && localStorage.getItem(key) === 'true');
  const creatorToken = localStorage.getItem(creatorKey(privateToken)) ?? '';
  const accessToken = useMemo(() => findAccessToken(privateToken), [privateToken]);
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(vapidKey);
  const canOptIn = confirmed || (Boolean(creatorToken) && (query.data?.completedCount ?? 0) > 0);
  const subscribeToReady = useSubscribeToBoothReady({ request: { headers: { 'X-Access-Token': accessToken } } });
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [status, setStatus] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<(Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null>(null);
  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> });
    };
    window.addEventListener('beforeinstallprompt', listener);
    return () => { window.removeEventListener('beforeinstallprompt', listener); };
  }, []);
  const setup = async () => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/booth/${privateToken}/notifications`)}`); return; }
    if (!canOptIn) { setStatus('Confirm a frame first. The private link remains available at any time.'); return; }
    if (!pushSupported || !vapidKey || !accessToken) { setStatus('Push setup is not available on this browser or device. Keep the private link so you can return.'); return; }
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') { setStatus('No problem. Keep the private link so you can return.'); return; }
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const normalizedKey = vapidKey.replace(/-/g, '+').replace(/_/g, '/');
      const paddedKey = normalizedKey + '='.repeat((4 - normalizedKey.length % 4) % 4);
      const applicationServerKey = Uint8Array.from(window.atob(paddedKey), (char) => char.charCodeAt(0));
      const subscription = existing ?? await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      const keys = subscription.toJSON().keys;
      if (!keys?.p256dh || !keys.auth) throw new Error('This browser did not provide a secure push subscription.');
      const data: PushSubscriptionInput = { endpoint: subscription.endpoint, expirationTime: subscription.expirationTime, keys: { p256dh: keys.p256dh, auth: keys.auth } };
      const saved = await subscribeToReady.mutateAsync({ privateToken, data });
      setIsSubscribed(saved.enabled);
      setStatus(saved.message || 'You’re set. Keep the private link nearby as a fallback.');
    } catch (reason) {
      setStatus(`${getError(reason)} Keep the private link so you can return.`);
    }
  };
  const install = async () => {
    if (!installPrompt) { setStatus('On iPhone or iPad, open in Safari and choose Share, then Add to Home Screen.'); return; }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setStatus(choice.outcome === 'accepted' ? 'Timecapsule was added to your Home Screen.' : 'No problem. The private link will always work.');
    setInstallPrompt(null);
  };
  const url = `${location.origin}/booth/${privateToken}`;
  return <Shell><div className="mx-auto max-w-[650px] py-10 sm:py-14">
    {confirmed && <div className="mb-5 rounded-2xl border border-[#c3d9cf] bg-[#e6f0eb] p-4 text-sm text-[#435c50]"><strong>Your frame is safely tucked away.</strong> It won’t be seen until everyone has confirmed.</div>}
    <Panel><p className="eyebrow text-[#e5786a]">✦ keep the link close</p><h1 className="serif mt-2 text-4xl sm:text-5xl">Come back when the booth is ready.</h1><p className="mt-3 leading-7 text-[#6f685f]">You can keep the private link to view the keepsake. Sign in if you’d like to enable a notification on this device.</p>
      <div className="mt-6 rounded-2xl bg-[#f0ebe3] p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#dce8e3]"><Heart size={20} /></span><div><strong>Keep your private link</strong><p className="mb-0 text-sm text-[#6f685f]">Anyone with the link can see the booth when it’s ready.</p></div></div><div className="mt-4 flex flex-wrap gap-3"><CopyButton text={url}><Link2 size={16} /> Copy booth link</CopyButton><a className="button-secondary inline-flex items-center no-underline" href={url}>Open booth</a></div></div>
      <div className="mt-5 rounded-2xl border border-[#e2dbd1] p-5"><h2 className="serif text-2xl">A gentle nudge on this device</h2><p className="text-sm leading-6 text-[#6f685f]">Notifications are optional. We’ll only ask after you choose, and only once a frame is confirmed. The private link always works as a fallback.</p><Button variant="secondary" disabled={Boolean(user) && (!canOptIn || !pushSupported || !accessToken || isSubscribed || subscribeToReady.isPending)} onClick={() => void setup()}>{!user ? 'Sign in to enable notifications' : subscribeToReady.isPending ? 'Setting up…' : isSubscribed ? 'Notifications set up' : !pushSupported ? 'Use the private link instead' : !canOptIn ? 'Available after frame confirmation' : 'Enable notifications'}</Button>{!canOptIn && <p className="mt-2 text-xs text-[#6f685f]">Finish your frame first. You can choose notifications after it is safely confirmed.</p>}{!pushSupported && <p className="mt-2 text-xs text-[#6f685f]">This browser needs service worker, push, notification support, and a configured public key. Save the private link instead.</p>}{status && <p role="status" className="mt-3 text-sm text-[#6f685f]">{status}</p>}{permission === 'denied' && <p className="mt-2 text-xs text-[#6f685f]">Your browser has notifications blocked. The private link works just as well.</p>}</div>
      <details className="mt-4 rounded-xl border border-[#e2dbd1] p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Add this booth to your Home Screen</summary><p className="mb-3 text-sm leading-6 text-[#6f685f]">On iPhone or iPad, open this link in Safari, tap Share, then choose “Add to Home Screen.” On Android, open the browser menu and choose “Install app” or “Add to Home screen.”</p><Button variant="secondary" onClick={() => void install()}>{installPrompt ? 'Install Timecapsule' : 'Show install instructions'}</Button></details>
      {query.data?.revealAvailable && <a className="button-primary mt-6 inline-flex items-center no-underline" href={`/booth/${privateToken}/reveal`}>See the finished keepsake <ArrowRight size={17} /></a>}
    </Panel>
  </div></Shell>;
}
