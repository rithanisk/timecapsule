import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  type BoothInput, type BoothState, type CanvasObject, type CustomizationInput,
  type FrameConfirmInput, type FrameUploadInput, type PushSubscriptionInput, type SlotClaimInput,
} from '@workspace/api-client-react';
import {
  getGetBoothQueryKey, useClaimBoothSlot, useConfirmBoothFrame, useCreateBooth,
  useDeleteBooth, useGetBooth, useRequestFrameUpload, useSaveBoothCustomization,
  useSubscribeToBoothReady,
} from '@workspace/api-client-react';
import { Button, CopyButton, ErrorNote, FramePreview, LoadingCard, Panel, ProgressDots, Shell, SlotList, TopBar, ArrowLeft, ArrowRight, Camera, Check, Download, Heart, Image, Link2, LoaderCircle, Palette, Share2, Sparkles, Trash2 } from '@/components/timecapsule-ui';

const layouts = [
  ['vertical', 'Photo strip'], ['horizontal', 'Side by side'], ['double', 'Double frame'],
  ['grid', 'Four-square'], ['editorial', 'Editorial'], ['freeform', 'Freeform'],
] as const;
const defaultPrompt = 'Look toward the next person.';
const creatorKey = (token: string) => `tc-creator:${token}`;
const participantKey = (token: string, slotId: string) => `tc-participant:${token}:${slotId}`;
const participantPrefix = (token: string) => `tc-participant:${token}:`;
const confirmedKey = (token: string, slotId: string) => `tc-confirmed:${token}:${slotId}`;

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
  return useGetBooth(privateToken, { query: { queryKey: getGetBoothQueryKey(privateToken), enabled: Boolean(privateToken), refetchInterval: (query) => {
    const data = query.state.data as BoothState | undefined;
    return data && (data.revealAvailable || data.status === 'expired' || data.status === 'deleted') ? false : 7000;
  } } });
}

function getError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export function HomePage() {
  const [, navigate] = useLocation();
  return <Shell>
    <TopBar right={<a href="#how" className="text-sm text-[#756f66] no-underline">How it works</a>} />
    <section className="grid min-h-[650px] items-center gap-10 py-12 lg:grid-cols-[1.02fr_.98fr] lg:py-20">
      <div className="max-w-[570px] animate-[fade-in_.6s_ease_both]">
        <p className="eyebrow mb-5 flex items-center gap-2"><span className="size-2 rounded-full bg-[#e5786a]" /> A little togetherness, on your own time</p>
        <h1 className="serif mb-6 text-[clamp(3.8rem,8vw,6.5rem)] leading-[.94] tracking-[-.045em]">Different places.<br /><em>One photobooth.</em></h1>
        <p className="max-w-[470px] text-lg leading-8 text-[#6f685f]">A private photo booth for your people. Everyone takes a frame when they can. The whole picture stays tucked away until everyone is ready.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Button onClick={() => navigate('/create')}>Make a booth <ArrowRight size={17} /></Button><a href="#how" className="button-secondary inline-flex items-center no-underline">See how it works</a></div>
        <div className="mt-8 flex items-center gap-3 text-sm text-[#756f66]"><LockGlyph /> No account for your friends. No frame revealed early.</div>
      </div>
      <div className="relative mx-auto w-full max-w-[510px] py-5">
        <div className="absolute -left-2 top-14 h-48 w-44 rotate-[-8deg] rounded-[25px] bg-[#dce8e3] sm:-left-7" />
        <div className="absolute -right-1 bottom-16 h-48 w-48 rotate-[7deg] rounded-[26px] bg-[#e8d8cb] sm:-right-6" />
        <div className="relative mx-auto w-[min(100%,360px)] rotate-[2deg] rounded-[7px] bg-[#fffdf8] p-4 shadow-[0_22px_55px_rgba(55,43,32,.16)]">
          <div className="grid gap-2">
            {['tone-0','tone-1','tone-2','tone-3'].map((tone, i) => <div key={tone} className={`hero-photo ${tone}`}><div className="hero-person"><span /></div><small>{['A Sunday, somewhere','Just got home','Same silly faces','Until next time'][i]}</small></div>)}
          </div>
          <p className="serif mb-0 mt-4 text-center text-xl italic text-[#4b4842]">the ordinary days</p>
        </div>
        <div className="absolute right-3 top-1 rounded-full bg-[#e5786a] px-4 py-2 text-xs font-semibold text-white shadow-md">made across miles</div>
      </div>
    </section>
    <section id="how" className="grid gap-5 border-t border-[#d9d1c5] py-12 sm:grid-cols-3 sm:py-16">
      {[['01','Set the scene','Name your booth, choose a look, and invite your favorite people.'],['02','Take your time','Each person claims a frame and snaps a photo whenever life allows.'],['03','Open it together','When every frame is confirmed, the finished keepsake is yours.']].map(([num,title,desc]) => <article key={num} className="py-3 sm:px-6"><span className="eyebrow text-[#e5786a]">{num} / A small ritual</span><h2 className="serif mt-4 text-3xl">{title}</h2><p className="mt-2 max-w-sm leading-7 text-[#6f685f]">{desc}</p></article>)}
    </section>
    <section className="rounded-[28px] bg-[#292723] px-6 py-10 text-[#fffdf8] sm:px-10 sm:py-12">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]"><div><p className="eyebrow text-[#d6cbbd]">For the people you miss</p><h2 className="serif mt-2 text-4xl sm:text-5xl">Make room for one more memory.</h2><p className="mt-3 text-[#d6cfc5]">A sibling group chat. Your far-away best friend. The family that never gets one good photo.</p></div><Button className="bg-[#fffdf8] !text-[#292723]" onClick={() => navigate('/create')}>Start a booth <ArrowRight size={17} /></Button></div>
    </section>
    <footer className="flex flex-wrap items-center justify-between gap-4 py-8 text-xs text-[#756f66]"><span>timecapsule · Different places. One photobooth.</span><span className="inline-flex items-center gap-2"><LockGlyph /> Private by default</span></footer>
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
  const [names, setNames] = useState(['You', '', '', '']);
  const [mode, setMode] = useState<'classic'|'scrapbook'>('classic');
  const [layout, setLayout] = useState<'vertical'|'horizontal'|'double'|'grid'|'editorial'|'freeform'>('vertical');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [countdownSeconds, setCountdownSeconds] = useState<3|5|10>(5);
  const [revealMode, setRevealMode] = useState<'complete'|'scheduled'>('complete');
  const [scheduledRevealAt, setScheduledRevealAt] = useState('');
  const setNameAt = (index: number, value: string) => setNames((prev) => prev.map((item, i) => i === index ? value : item));
  const submit = () => {
    const slots = Array.from({ length: count }, (_, i) => names[i]?.trim() || (i === 0 ? 'You' : `Friend ${i}`));
    const data: BoothInput = { name: name.trim(), subtitle: subtitle.trim(), occasion: occasion.trim(), participantCount: count, slots, mode, layout, prompt, countdownSeconds, revealMode, scheduledRevealAt: revealMode === 'scheduled' && scheduledRevealAt ? new Date(scheduledRevealAt).toISOString() : null };
    createBooth.mutate({ data }, { onSuccess: (created) => {
      localStorage.setItem(creatorKey(created.privateToken), created.creatorToken);
      const firstSlot = created.state.slots[0];
      if (firstSlot) {
        const claimData: SlotClaimInput = { displayName: names[0]?.trim() || 'You', slotId: firstSlot.id };
        claimSlot.mutate({ privateToken: created.privateToken, data: claimData }, { onSuccess: (result) => {
          localStorage.setItem(participantKey(created.privateToken, result.slotId), result.participantToken);
          navigate(`/join/${created.privateToken}/capture?slot=${encodeURIComponent(result.slotId)}`);
        }, onError: () => {
          navigate(`/booth/${created.privateToken}`);
        } });
      } else {
        navigate(`/booth/${created.privateToken}`);
      }
    } });
  };
  return <Shell><TopBar right={<span className="eyebrow">Create a private booth</span>} />
    <div className="mx-auto max-w-[760px] py-8 sm:py-12">
      <button onClick={() => step === 1 ? navigate('/') : setStep(step - 1)} className="button-quiet mb-5 inline-flex items-center gap-2 !px-0"><ArrowLeft size={16} /> Back</button>
      <div className="mb-7 flex items-center justify-between"><p className="eyebrow">A few details, then it’s yours</p><span className="text-xs text-[#756f66]">STEP {step} OF 3</span></div>
      <div className="mb-8 h-1.5 overflow-hidden rounded-full bg-[#e9e2d8]"><div className="h-full rounded-full bg-[#e5786a] transition-all" style={{ width: `${step * 33.333}%` }} /></div>
      <Panel>
        {step === 1 && <div><h1 className="serif text-4xl sm:text-5xl">Name your little corner.</h1><p className="mb-7 mt-2 text-[#6f685f]">Make it sound like your group—not a template.</p>
          <label className="field-label" htmlFor="booth-name">Booth name</label><input id="booth-name" data-testid="input-booth-name" className="input-paper mb-5" maxLength={50} placeholder="Four time zones, still us" value={name} onChange={(e) => setName(e.target.value)} />
          <label className="field-label" htmlFor="booth-subtitle">A little note (optional)</label><input id="booth-subtitle" className="input-paper mb-5" maxLength={80} placeholder="For the people who feel like home" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          <label className="field-label" htmlFor="occasion">What are you celebrating?</label><input id="occasion" className="input-paper mb-6" maxLength={40} placeholder="Birthday, just because, reunion…" value={occasion} onChange={(e) => setOccasion(e.target.value)} />
          <span className="field-label">How many frames?</span><div className="mb-7 flex gap-3">{[2,3,4,5,6].map((n) => <button key={n} aria-pressed={count === n} onClick={() => { setCount(n); setNames((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? '')); }} className={`grid size-12 min-h-11 min-w-11 place-items-center rounded-full border font-semibold ${count === n ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{n}</button>)}</div>
          <span className="field-label">Names on the frames</span><div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: count }, (_, i) => <label key={i} className="flex items-center gap-2"><span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${['bg-[#ecd1c8]','bg-[#d5e2dc]','bg-[#dbe4f0]','bg-[#f0e2c2]'][i % 4]}`}>{i+1}</span><input className="input-paper !min-h-[46px]" aria-label={`Name for frame ${i + 1}`} maxLength={30} placeholder={i ? `Friend ${i}` : 'Your name'} value={names[i] ?? ''} onChange={(e) => setNameAt(i,e.target.value)} /></label>)}</div>
        </div>}
        {step === 2 && <div><h1 className="serif text-4xl sm:text-5xl">Choose the feeling.</h1><p className="mb-7 mt-2 text-[#6f685f]">Start with a complete look. Change the details later.</p>
          <div className="grid gap-4 sm:grid-cols-2">{(['classic','scrapbook'] as const).map((choice) => <button key={choice} onClick={() => setMode(choice)} aria-pressed={mode === choice} className={`rounded-[20px] border p-4 text-left ${mode === choice ? 'border-[#292723] ring-1 ring-[#292723]' : 'border-[#d9d1c5]'}`}><div className="mb-4 flex items-center justify-between"><strong className="text-sm uppercase tracking-wide">{choice} booth</strong><span className={`size-5 rounded-full border ${mode === choice ? 'border-[#292723] bg-[#292723] shadow-[inset_0_0_0_4px_#fffdf8]' : 'border-[#c6bdae]'}`} /></div><div className={`mx-auto max-w-[170px] ${choice === 'scrapbook' ? 'rounded-xl bg-[#dce8e3] p-3' : 'bg-white p-3 shadow-sm'}`}><FramePreview photos={[]} mode={choice} layout="vertical" compact /></div><p className="mb-0 mt-3 text-sm text-[#6f685f]">{choice === 'classic' ? 'A timeless printed strip, neat and familiar.' : 'Loose paper, playful notes, a little more you.'}</p></button>)}</div>
          <div className="mt-7"><span className="field-label">Arrange the frames</span><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{layouts.map(([key,label]) => <button key={key} aria-pressed={layout === key} onClick={() => setLayout(key)} className={`min-h-12 rounded-xl border px-3 text-sm ${layout === key ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{label}</button>)}</div></div>
        </div>}
        {step === 3 && <div><h1 className="serif text-4xl sm:text-5xl">Set the moment.</h1><p className="mb-7 mt-2 text-[#6f685f]">A tiny prompt helps everyone feel part of the same picture.</p>
          <label className="field-label" htmlFor="prompt">Today's prompt</label><textarea id="prompt" data-testid="input-prompt" className="input-paper mb-6 min-h-24 resize-y" maxLength={120} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          <span className="field-label">Camera countdown</span><div className="mb-6 flex gap-2">{([3,5,10] as const).map((seconds) => <button key={seconds} aria-pressed={countdownSeconds === seconds} onClick={() => setCountdownSeconds(seconds)} className={`min-h-11 rounded-full border px-5 ${countdownSeconds === seconds ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{seconds} seconds</button>)}</div>
          <span className="field-label">When should the photos open?</span><div className="grid gap-3 sm:grid-cols-2"><button onClick={() => setRevealMode('complete')} aria-pressed={revealMode === 'complete'} className={`rounded-xl border p-4 text-left ${revealMode === 'complete' ? 'border-[#292723] bg-[#f1ece4]' : 'border-[#d9d1c5]'}`}><strong>When everyone’s ready</strong><span className="mt-1 block text-sm text-[#6f685f]">The keepsake opens when all frames are confirmed.</span></button><button onClick={() => setRevealMode('scheduled')} aria-pressed={revealMode === 'scheduled'} className={`rounded-xl border p-4 text-left ${revealMode === 'scheduled' ? 'border-[#292723] bg-[#f1ece4]' : 'border-[#d9d1c5]'}`}><strong>On a chosen date</strong><span className="mt-1 block text-sm text-[#6f685f]">Everyone’s frame stays hidden until then.</span></button></div>
          {revealMode === 'scheduled' && <div className="mt-4"><label className="field-label" htmlFor="reveal-date">Reveal date and time</label><input id="reveal-date" type="datetime-local" className="input-paper" value={scheduledRevealAt} onChange={(e) => setScheduledRevealAt(e.target.value)} /></div>}
          <p className="mt-6 flex items-center gap-2 text-sm text-[#6f685f]"><LockGlyph /> Photos remain hidden until every required frame is confirmed and the reveal time arrives.</p>
        </div>}
        {createBooth.isError && <div className="mt-5"><ErrorNote message={getError(createBooth.error)} /></div>}
        {claimSlot.isError && <div className="mt-5"><ErrorNote message={getError(claimSlot.error)} /></div>}
        <div className="mt-8 flex justify-end">{step < 3 ? <Button disabled={step === 1 && name.trim().length < 1} onClick={() => setStep(step+1)}>Continue <ArrowRight size={17} /></Button> : <Button disabled={createBooth.isPending || claimSlot.isPending || !name.trim() || (revealMode === 'scheduled' && !scheduledRevealAt)} onClick={submit}>{createBooth.isPending || claimSlot.isPending ? <LoaderCircle className="animate-spin" /> : <Sparkles size={17} />} Create private booth</Button>}</div>
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
  const query = useBooth(privateToken);
  const booth = query.data;
  const creatorToken = localStorage.getItem(creatorKey(privateToken));
  const deleteBooth = useDeleteBooth({ request: { headers: { 'X-Creator-Token': creatorToken ?? '' } } });
  const inviteUrl = `${location.origin}/join/${privateToken}`;
  const deleteIt = () => {
    if (!creatorToken || !window.confirm('Delete this booth and all of its frames? This cannot be undone.')) return;
    deleteBooth.mutate({ privateToken }, { onSuccess: () => {
      localStorage.removeItem(creatorKey(privateToken));
      Object.keys(localStorage).filter((key) => key.startsWith(participantPrefix(privateToken)) || key.startsWith(`tc-confirmed:${privateToken}:`)).forEach((key) => localStorage.removeItem(key));
      navigate('/');
    } });
  };
  return <Shell><TopBar right={<span className="eyebrow">Your private booth</span>} /><div className="mx-auto max-w-[820px] py-8 sm:py-12">
    <button onClick={() => navigate('/')} className="button-quiet mb-6 inline-flex items-center gap-2 !px-0"><ArrowLeft size={16} /> Home</button>
    {query.isLoading || !booth ? <BoothLoading error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="mb-7"><p className="eyebrow">A little place for your people</p><h1 className="serif mt-2 text-5xl sm:text-6xl">{booth.name}</h1>{booth.subtitle && <p className="mt-2 text-[#6f685f]">{booth.subtitle}</p>}</div>
      {booth.revealAvailable ? <div className="mb-7 rounded-2xl border border-[#c2d9cf] bg-[#e6f0eb] p-5"><strong className="serif text-2xl">Everyone’s here. Your booth is ready.</strong><p className="mt-1 text-sm text-[#586d63]">The frames are together at last.</p><Button className="mt-4" onClick={() => navigate(`/booth/${privateToken}/reveal`)}>Open the photobooth <ArrowRight size={17} /></Button></div> : <div className="mb-7"><h2 className="serif text-3xl">{booth.completedCount === 0 ? 'The first frame is still to come.' : `${booth.participantCount - booth.completedCount} ${booth.participantCount - booth.completedCount === 1 ? 'frame' : 'frames'} left to come in.`}</h2><p className="mt-1 text-[#6f685f]">Photos stay tucked away until everyone is in.</p>{booth.scheduledRevealAt && <p className="mt-2 text-sm text-[#756f66]">The chosen reveal time is {new Date(booth.scheduledRevealAt).toLocaleString()}.</p>}</div>}
      <Panel><div className="mb-5 flex flex-wrap items-center justify-between gap-4"><div><span className="eyebrow">The little roll call</span><p className="mb-0 mt-1 font-semibold">{booth.completedCount} of {booth.participantCount} frames confirmed</p></div><ProgressDots total={booth.participantCount} complete={booth.completedCount} /></div><SlotList slots={booth.slots} hidePhotos={!booth.revealAvailable} /><div className="mt-6 flex flex-wrap gap-3"><CopyButton text={inviteUrl}><Link2 size={16} /> Copy invitation link</CopyButton><Button variant="secondary" onClick={() => { const text = `A photobooth for us: ${inviteUrl}`; if (navigator.share) void navigator.share({ title: booth.name, text, url: inviteUrl }); else void navigator.clipboard.writeText(text); }}><Share2 size={16} /> Share invite</Button><Button variant="quiet" onClick={() => navigate(`/booth/${privateToken}/notifications`)}>Gentle reminders</Button></div></Panel>
      {!creatorToken && <p className="mt-4 rounded-xl bg-[#f2e5d8] p-4 text-sm text-[#6f5147]">Creator controls are available on the device where this booth was created.</p>}
      <div className="mt-4 flex flex-wrap gap-2">{booth.revealAvailable && <Button variant="secondary" onClick={() => navigate(`/booth/${privateToken}/edit`)}><Palette size={16} /> Customize keepsake</Button>}<Button variant="quiet" disabled={!creatorToken || deleteBooth.isPending} onClick={deleteIt}><Trash2 size={16} /> Delete booth</Button></div>
      {deleteBooth.isError && <div className="mt-4"><ErrorNote message={getError(deleteBooth.error)} /></div>}
    </>}
  </div></Shell>;
}

export function JoinPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const query = useBooth(privateToken);
  const claim = useClaimBoothSlot();
  const [displayName, setDisplayName] = useState('');
  const [slotId, setSlotId] = useState('');
  const booth = query.data;
  const selectable = booth?.slots.filter((slot) => slot.claimStatus === 'open') ?? [];
  const selectedSlot = selectable.find((slot) => slot.id === slotId) ?? selectable[0];
  const assignedName = selectedSlot?.displayName.trim() ?? '';
  const claimDisplayName = assignedName || displayName;
  const submit = () => {
    const data: SlotClaimInput = { displayName: claimDisplayName.trim(), slotId: selectedSlot?.id ?? null };
    claim.mutate({ privateToken, data }, { onSuccess: (result) => {
      localStorage.setItem(participantKey(privateToken, result.slotId), result.participantToken);
      navigate(`/join/${privateToken}/capture?slot=${encodeURIComponent(result.slotId)}`);
    } });
  };
  return <Shell><TopBar right={<span className="eyebrow">You’re invited</span>} /><div className="mx-auto max-w-[620px] py-9 sm:py-14">
    {query.isLoading || !booth ? <BoothLoading error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="rounded-[28px] bg-[#292723] px-6 py-8 text-center text-[#fffdf8] sm:px-10"><p className="eyebrow text-[#cfc8be]">{booth.occasion || 'A private photobooth'}</p><h1 className="serif mt-3 text-4xl sm:text-5xl">{booth.name}</h1>{booth.subtitle && <p className="mb-0 mt-3 text-[#ded7ce]">{booth.subtitle}</p>}<p className="mb-0 mt-5 text-xs text-[#cfc8be]">{booth.participantCount} FRAMES · ABOUT A MINUTE EACH</p></div>
      <Panel className="mt-5"><span className="eyebrow">A little prompt</span><blockquote className="serif mb-0 mt-2 rounded-2xl bg-[#f1e5dc] p-5 text-2xl">{booth.prompt || defaultPrompt}</blockquote>
        {booth.revealAvailable ? <div className="mt-5 rounded-xl bg-[#e6f0eb] p-4 text-sm">This booth is ready to open. <button className="underline" onClick={() => navigate(`/booth/${privateToken}/reveal`)}>See the finished keepsake</button></div> : <>
          <h2 className="serif mb-1 mt-7 text-3xl">Choose your frame.</h2><p className="mb-5 text-sm text-[#6f685f]">No account, no rush. Your photo stays private until everyone’s ready.</p>
          {selectable.length === 0 ? <div className="rounded-xl border border-dashed border-[#cfc5b7] p-5 text-center text-sm text-[#6f685f]">All the frames have been claimed. Ask the booth maker to share an open spot.</div> : <>
            <label className="field-label" htmlFor="invite-slot">Pick your open frame</label><select id="invite-slot" className="input-paper mb-2" value={selectedSlot?.id ?? ''} onChange={(e) => setSlotId(e.target.value)}>{selectable.map((slot) => <option key={slot.id} value={slot.id}>{slot.displayName || `Frame ${slot.position}`}</option>)}</select>
            {assignedName ? <p className="mb-4 text-sm text-[#6f685f]">This frame is labeled <strong>{assignedName}</strong>.</p> : <><label className="field-label" htmlFor="invite-name">Your name</label><input id="invite-name" data-testid="input-participant-name" className="input-paper mb-4" maxLength={30} placeholder="What should we call you?" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></>}
            <div className="flex items-center gap-2 text-xs text-[#6f685f]"><LockGlyph /> Your frame is hidden from the group until all are confirmed.</div>
            {claim.isError && <div className="mt-4"><ErrorNote message={getError(claim.error)} /></div>}
            <Button className="mt-5 w-full" disabled={!claimDisplayName.trim() || claim.isPending} onClick={submit}>{claim.isPending ? <LoaderCircle className="animate-spin" /> : null} Claim this frame <ArrowRight size={17} /></Button>
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
  const slot = boothQuery.data?.slots.find((s) => s.id === slotId);
  const participantToken = token ?? '';
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
  const [error, setError] = useState('');
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
  useEffect(() => { void cameraStart(); return () => streamRef.current?.getTracks().forEach((track) => track.stop()); }, [cameraStart]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
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
    if (!candidate || !slotId || !participantToken) return;
    setError('');
    try {
      const data: FrameUploadInput = { name: candidate.name.slice(0,180), size: candidate.size, contentType: candidate.type as FrameUploadInput['contentType'] };
      const destination = await requestUpload.mutateAsync({ privateToken, slotId, data });
      const put = await fetch(destination.uploadURL, { method: 'PUT', headers: { 'Content-Type': candidate.type }, body: candidate });
      if (!put.ok) throw new Error('The secure upload did not finish. Please try again.');
      const dimensions = await new Promise<{width:number;height:number}>((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('We could not read the selected photo.'));
        image.src = preview;
      });
      const confirmData: FrameConfirmInput = { objectPath: destination.objectPath, ...dimensions, captureSource: source };
      await confirmFrame.mutateAsync({ privateToken, slotId, data: confirmData });
      localStorage.setItem(confirmedKey(privateToken, slotId), 'true');
      await queryClient.invalidateQueries({ queryKey: getGetBoothQueryKey(privateToken) });
      const isCreator = Boolean(localStorage.getItem(creatorKey(privateToken)));
      if (isCreator && preview) {
        sessionStorage.setItem(`tc-preview:${privateToken}`, preview);
        navigate(`/booth/${privateToken}/style`);
      } else {
        navigate(`/booth/${privateToken}/notifications?confirmed=1`);
      }
    } catch (reason) { setError(getError(reason)); }
  };
  if (!slotId || !token) return <Shell><TopBar /><div className="mx-auto max-w-lg py-12"><Panel><h1 className="serif text-3xl">Your frame link is needed.</h1><p className="text-[#6f685f]">Open the invitation and claim an available frame first. Your participant key is kept on this device.</p><a href={`/join/${privateToken}`} className="button-primary mt-4 inline-flex items-center no-underline">Back to invitation</a></Panel></div></Shell>;
  const photoBusy = requestUpload.isPending || confirmFrame.isPending;
  return <main className="min-h-[100dvh] bg-[#292723] px-4 pb-10 text-[#fffdf8]">
    <header className="mx-auto flex min-h-[66px] max-w-[720px] items-center justify-between"><a href={`/join/${privateToken}`} className="inline-flex min-h-11 items-center gap-2 text-sm text-[#ded7ce] no-underline"><ArrowLeft size={17} /> Invitation</a><span className="eyebrow text-[#cfc8be]">{slot?.displayName || 'Your frame'}</span></header>
    {!preview ? <div className="mx-auto max-w-[600px]">
      <div className="mb-4 text-center"><h1 className="serif mb-1 text-4xl">Find your frame.</h1><p className="mb-0 text-sm text-[#d1c9be]">{boothQuery.data?.prompt || defaultPrompt}</p></div>
      <div className="camera-stage relative mx-auto aspect-[4/5] max-h-[68dvh] overflow-hidden rounded-[28px] border border-[#59554f] bg-[#3d3a35]">
        <video ref={videoRef} autoPlay muted playsInline className={`h-full w-full object-cover ${mirror ? 'scale-x-[-1]' : ''}`} />
        <div className="pointer-events-none absolute inset-[7%] rounded-[22px] border border-dashed border-white/70" />
        <div className="absolute left-1/2 top-4 max-w-[90%] -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-center text-xs">{boothQuery.data?.prompt || defaultPrompt}</div>
        {countdown !== null && <div className="absolute inset-0 grid place-items-center bg-black/20"><span className="serif text-[8rem] leading-none text-white drop-shadow-lg">{countdown}</span></div>}
        {streamError && <div className="absolute inset-x-4 bottom-4 rounded-xl bg-black/70 p-3 text-center text-sm">{streamError}</div>}
      </div>
      <div className="mt-5 flex items-center justify-center gap-8"><button aria-label="Choose photo from device" className="grid size-12 place-items-center rounded-full bg-white/10" onClick={() => fileRef.current?.click()}><Image size={19} /></button><button aria-label="Take photo" className="grid size-[76px] place-items-center rounded-full border-[5px] border-white bg-transparent" onClick={capture} disabled={countdown !== null}><span className="size-[54px] rounded-full bg-white" /></button><button aria-label="Switch camera" className="grid size-12 place-items-center rounded-full bg-white/10" onClick={() => setFacing((value) => value === 'user' ? 'environment' : 'user')}><Camera size={19} /></button></div>
      <div className="mt-4 flex flex-wrap justify-center gap-3"><Button variant="quiet" className="!text-[#d1c9be]" onClick={() => setMirror((v) => !v)}>Mirror: {mirror ? 'on' : 'off'}</Button><Button variant="quiet" className="!text-[#d1c9be]" onClick={() => fileRef.current?.click()}>Choose a photo</Button></div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])} />
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
      <p className="mt-4 text-center text-xs text-[#bdb6ad]">Your photo isn’t uploaded until you confirm it.</p>
    </div> : <div className="mx-auto max-w-[600px]"><h1 className="serif mb-1 text-center text-4xl">Keep this one?</h1><p className="mb-5 text-center text-sm text-[#d1c9be]">Nothing is shared until you confirm.</p>
      <div className="relative mx-auto aspect-[4/5] max-h-[66dvh] overflow-hidden rounded-[26px] bg-[#47433d]"><img src={preview} alt="Your photo preview" className="h-full w-full object-cover" style={{ transform: mirror && source === 'camera' ? 'scaleX(-1)' : undefined }} /></div>
      <div className="mx-auto mt-5 flex max-w-[460px] gap-3"><Button variant="secondary" className="flex-1" onClick={retake} disabled={photoBusy}>Retake</Button><Button variant="secondary" className="flex-1" onClick={() => setMirror((v) => !v)}>Mirror: {mirror ? 'on' : 'off'}</Button></div>
      {error && <p role="alert" className="mt-3 text-center text-sm text-[#f2bdb0]">{error}</p>}
      <div className="sticky bottom-0 left-0 right-0 bg-gradient-to-t from-[#292723] via-[#292723] to-transparent pb-4 pt-6">
        <Button className="mx-auto flex w-full max-w-[460px] bg-[#fffdf8] !text-[#292723]" disabled={photoBusy} onClick={() => void confirm()}>{photoBusy ? <><LoaderCircle className="animate-spin" /> Saving privately…</> : <>Use this photo <Check size={17} /></>}</Button>
        <p className="mt-2 text-center text-xs text-[#bdb6ad]">Visible only after every frame is confirmed.</p>
      </div>
    </div>}
  </main>;
}

export function RevealPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const query = useBooth(privateToken);
  const [skip, setSkip] = useState(false);
  const [replay, setReplay] = useState(0);
  const [shareMessage, setShareMessage] = useState('');
  const booth = query.data;
  const photos = useMemo(() => booth?.slots.map((slot) => slot.photoUrl).filter((url): url is string => Boolean(url)) ?? [], [booth?.slots]);
  const exportArtifact = async () => {
    if (!booth) return;
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1900;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const layout = booth.customization.layout || booth.layout;
    const n = booth.slots.length; const gap = 24; const pad = 55;
    const twoColumns = ['horizontal','double','grid','freeform'].includes(layout);
    const columns = twoColumns ? 2 : 1;
    const rows = layout === 'double' ? 1 + Math.ceil((n - 1) / 2) : Math.ceil(n / columns);
    const frameType = booth.customization.frameType;
    ctx.fillStyle = frameType === 'black' || frameType === 'film' ? '#292723' : booth.customization.frameColor || '#fffdf8';
    ctx.fillRect(0,0,1000,1900);
    const filterByName: Record<string,string> = { 'soft-bw':'grayscale(.78) contrast(.96)', 'high-contrast':'contrast(1.18) saturate(.8)', 'warm-film':'sepia(.26) saturate(1.08)', 'cool-flash':'saturate(.82) hue-rotate(8deg) brightness(1.04)', faded:'saturate(.62) brightness(1.08) contrast(.9)', disposable:'saturate(1.16) contrast(1.08)', sepia:'sepia(.68) saturate(.82)', grain:'contrast(1.07) saturate(.9)', original:'none' };
    const inset = frameType === 'film' ? 70 : frameType === 'polaroid' ? 70 : pad;
    const exportCellW = (1000-inset*2-gap*(columns-1))/columns;
    const exportCellH = (1710-pad*2-gap*(rows-1))/rows;
    for (let i=0;i<n;i++) {
      const slot = booth.slots[i];
      const isWideHero = layout === 'double' && i === 0;
      const itemIndex = layout === 'double' && i > 0 ? i - 1 : i;
      const x = isWideHero ? pad : inset+(itemIndex%columns)*(exportCellW+gap)+(layout === 'freeform' && i%2 ? 24 : 0);
      const y = isWideHero ? pad : pad+(layout === 'double' ? 1+Math.floor(itemIndex/columns) : Math.floor(itemIndex/columns))*(exportCellH+gap)+(layout === 'freeform' && i%2 ? 15 : 0);
      const itemW = isWideHero ? 890 : exportCellW;
      const itemH = isWideHero ? exportCellH : exportCellH;
      ctx.fillStyle = ['#9fb9c7','#e6c4b5','#c6d9b8','#b8c8e6'][i%4]; ctx.fillRect(x,y,itemW,itemH);
      if (slot.photoUrl) {
        try {
          const image = new window.Image(); image.crossOrigin = 'anonymous'; image.src = slot.photoUrl;
          await new Promise<void>((resolve) => {
            image.onload = () => { ctx.filter = filterByName[booth.customization.filter] || 'none'; ctx.drawImage(image,x,y,itemW,itemH); ctx.filter = 'none'; resolve(); };
            image.onerror = () => resolve();
          });
        } catch { /* Keep the paper placeholder if image export is blocked. */ }
      }
    }
    ctx.fillStyle = frameType === 'black' || frameType === 'film' ? '#fffdf8' : '#292723';
    ctx.textAlign = 'center'; ctx.font = 'italic 56px Georgia'; ctx.fillText(booth.customization.caption || booth.name,500,1830);
    if (booth.customization.showDate) { ctx.font = '22px sans-serif'; ctx.fillText(new Date().toLocaleDateString(),500,1862); }
    ctx.font = '18px sans-serif'; ctx.fillText('DIFFERENT PLACES · ONE PHOTOBOOTH',500,1890);
    for (const object of booth.customization.objects) {
      ctx.save(); ctx.translate(object.x*1000, object.y*1900); ctx.rotate(object.rotation*Math.PI/180);
      ctx.fillStyle = object.color; ctx.textAlign = 'center'; ctx.font = object.kind === 'text' ? '30px Georgia' : '48px Georgia'; ctx.fillText(object.label,0,0,650); ctx.restore();
    }
    canvas.toBlob((blob) => { if (!blob) return; const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${booth.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-photobooth.png`; link.click(); URL.revokeObjectURL(url); },'image/png');
  };
  if (query.isLoading || !booth) return <Shell dark><TopBar dark /><div className="mx-auto max-w-[700px] py-12"><BoothLoading error={query.error} retry={() => void query.refetch()} /></div></Shell>;
  if (!booth.revealAvailable) return <Shell><TopBar /><div className="mx-auto max-w-[660px] py-14"><Panel className="text-center"><span className="mx-auto grid size-16 place-items-center rounded-full bg-[#f0e4d7]"><LockGlyph /></span><h1 className="serif mt-5 text-4xl">Not quite time yet.</h1><p className="mx-auto max-w-md text-[#6f685f]">The photos are kept private until every frame is confirmed and the reveal time arrives.</p><ProgressDots total={booth.participantCount} complete={booth.completedCount} /><p className="mt-2 text-sm">{booth.completedCount} of {booth.participantCount} ready</p><Button className="mt-4" variant="secondary" onClick={() => navigate(`/booth/${privateToken}`)}>Back to the booth</Button></Panel></div></Shell>;
  return <main className="min-h-[100dvh] overflow-hidden bg-[#292723] px-5 pb-10 text-[#fffdf8]">
    <header className="mx-auto flex min-h-[68px] max-w-[840px] items-center justify-between"><span className="font-semibold">timecapsule</span><button className="button-quiet !text-[#cfc8be]" onClick={() => setSkip(true)}>{skip ? 'Ready' : 'Skip reveal'}</button></header>
    <div className="mx-auto max-w-[840px] text-center"><p className="eyebrow text-[#cfc8be]">A moment from everywhere</p><h1 key={`title-${replay}`} className={`serif mt-2 text-4xl sm:text-5xl ${skip ? 'opacity-100' : 'reveal-copy'}`}>{booth.name}</h1>{booth.subtitle && <p className={`mt-2 text-[#d6cfc5] ${skip ? '' : 'reveal-copy'}`}>{booth.subtitle}</p>}
      <div className="mx-auto mt-7 w-[min(100%,480px)] overflow-hidden rounded-[18px]"><div key={`print-${replay}`} className={skip ? '' : 'reveal-print'}><FramePreview photos={photos} layout={booth.customization.layout || booth.layout} mode={booth.customization.mode || booth.mode} caption={booth.customization.caption} frameColor={booth.customization.frameColor} filter={booth.customization.filter} frameType={booth.customization.frameType} objects={booth.customization.objects} showDate={booth.customization.showDate} /></div></div>
      <div className={`mt-7 flex flex-wrap justify-center gap-3 ${skip ? '' : 'reveal-copy'}`}><Button className="bg-[#fffdf8] !text-[#292723]" onClick={() => void exportArtifact()}><Download size={17} /> Download keepsake</Button><Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => { setReplay((v) => v+1); setSkip(false); }}><Sparkles size={16} /> Replay</Button><Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => navigate(`/booth/${privateToken}/edit`)}><Palette size={16} /> Customize</Button><Button variant="secondary" className="!border-[#6d6962] !bg-[#3b3935] !text-white" onClick={() => { const url = location.href; if (navigator.share) void navigator.share({ title: booth.name, url }); else { void navigator.clipboard.writeText(url); setShareMessage('Private link copied.'); } }}><Share2 size={16} /> Share link</Button></div>
      {shareMessage && <p className="mt-3 text-sm text-[#d6cfc5]" role="status">{shareMessage}</p>}<p className={`mt-5 text-sm text-[#cfc8be] ${skip ? '' : 'reveal-copy'}`}>Different places. One photobooth.</p>
    </div>
  </main>;
}

const defaultCustomization = (booth: BoothState): CustomizationInput => ({
  mode: booth.customization?.mode ?? booth.mode,
  layout: booth.customization?.layout ?? booth.layout,
  frameType: booth.customization?.frameType ?? 'clean',
  frameColor: booth.customization?.frameColor ?? '#FFFDF8',
  filter: booth.customization?.filter ?? 'original',
  showDate: booth.customization?.showDate ?? true,
  caption: booth.customization?.caption ?? '',
  objects: booth.customization?.objects ?? [],
});
const filters: Array<[CustomizationInput['filter'],string]> = [['original','Original'],['soft-bw','Soft B&W'],['high-contrast','Contrast'],['warm-film','Warm film'],['cool-flash','Cool flash'],['faded','Faded'],['disposable','Disposable'],['sepia','Sepia'],['grain','Grain']];
const frameColors = ['#FFFDF8','#292723','#E5786A','#A9C7BD','#AFC4E6','#EBCB8B'];

export function EditorPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const query = useBooth(privateToken);
  const booth = query.data;
  const creatorToken = localStorage.getItem(creatorKey(privateToken)) ?? '';
  const save = useSaveBoothCustomization({ request: { headers: { 'X-Creator-Token': creatorToken } } });
  const [tab, setTab] = useState<'Layout'|'Frame'|'Filter'|'Stickers'|'Text'>('Layout');
  const [custom, setCustom] = useState<CustomizationInput | null>(null);
  const [history, setHistory] = useState<CustomizationInput[]>([]);
  const [redoHistory, setRedoHistory] = useState<CustomizationInput[]>([]);
  const [dirty, setDirty] = useState(false);
  const debounce = useRef<number | undefined>(undefined);
  const dragRef = useRef<{id:string; x:number;y:number; originX:number;originY:number;rect:DOMRect}|null>(null);
  useEffect(() => { if (booth) setCustom((existing) => existing ?? defaultCustomization(booth)); }, [booth]);
  const update = (patch: Partial<CustomizationInput>) => {
    setCustom((current) => {
      if (!current) return current;
      setHistory((h) => [...h.slice(-19), current]);
      setRedoHistory([]);
      setDirty(true);
      return { ...current, ...patch };
    });
  };
  const saveNow = useCallback((value: CustomizationInput) => save.mutate({ privateToken, data: value }, { onSuccess: (saved) => {
    queryClient.setQueryData<BoothState>(getGetBoothQueryKey(privateToken), (old) => old ? { ...old, customization: saved } : old);
    setDirty(false);
  } }), [privateToken, save.mutate, queryClient]);
  const saveAndExit = async () => {
    if (!creatorToken || !custom) return;
    try {
      const saved = await save.mutateAsync({ privateToken, data: custom });
      queryClient.setQueryData<BoothState>(getGetBoothQueryKey(privateToken), (old) => old ? { ...old, customization: saved } : old);
      setDirty(false);
      navigate(`/booth/${privateToken}/reveal`);
    } catch { /* The visible mutation error gives the user a retry path. */ }
  };
  useEffect(() => {
    if (!dirty || !custom || !creatorToken) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => saveNow(custom), 900);
    return () => window.clearTimeout(debounce.current);
  }, [custom, dirty, creatorToken, saveNow]);
  const addObject = (kind: 'sticker'|'text', label: string) => {
    const object: CanvasObject = { id: `${kind}-${Date.now()}`, kind, label, x: .5, y: .5, width: kind === 'text' ? .55 : .15, height: kind === 'text' ? .12 : .12, rotation: 0, color: kind === 'text' ? '#292723' : '#E5786A', zIndex: (custom?.objects.length ?? 0) + 1 };
    update({ objects: [...(custom?.objects ?? []), object] });
    if (kind === 'text') setTab('Text');
  };
  const moveObject = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || !custom) return;
    const nextX = Math.max(.03,Math.min(.97,drag.originX+(event.clientX-drag.x)/drag.rect.width));
    const nextY = Math.max(.03,Math.min(.97,drag.originY+(event.clientY-drag.y)/drag.rect.height));
    setCustom((value) => value ? { ...value, objects: value.objects.map((object) => object.id === drag.id ? { ...object, x: nextX, y: nextY } : object) } : value);
  };
  if (query.isLoading || !booth || !custom) return <Shell><TopBar /><div className="mx-auto max-w-4xl py-12"><BoothLoading error={query.error} retry={() => void query.refetch()} /></div></Shell>;
  if (!booth.revealAvailable) return <Shell><TopBar /><div className="mx-auto max-w-xl py-12"><Panel><h1 className="serif text-3xl">The keepsake will be ready soon.</h1><p>Customization opens once the full photobooth is revealed.</p><Button onClick={() => navigate(`/booth/${privateToken}`)}>Back to booth</Button></Panel></div></Shell>;
  const colors = custom.frameColor;
  const undo = () => { const previous = history.at(-1); if (!previous) return; setRedoHistory((v) => [...v,custom]); setCustom(previous); setHistory((v) => v.slice(0,-1)); setDirty(true); };
  const redo = () => { const next = redoHistory.at(-1); if (!next) return; setHistory((v) => [...v,custom]); setCustom(next); setRedoHistory((v) => v.slice(0,-1)); setDirty(true); };
  return <Shell><TopBar right={<div className="flex items-center gap-2"><button aria-label="Undo" className="button-quiet" disabled={!history.length} onClick={undo}>Undo</button><button aria-label="Redo" className="button-quiet" disabled={!redoHistory.length} onClick={redo}>Redo</button><Button disabled={!creatorToken || save.isPending} onClick={() => void saveAndExit()}>{save.isPending ? 'Saving…' : dirty ? 'Save & done' : 'Done'}</Button></div>} />
    <div className="mx-auto max-w-[1100px] py-6"><div className="mb-5"><p className="eyebrow">A keepsake, made yours</p><h1 className="serif mt-1 text-4xl">Customize the reveal</h1></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(340px,.9fr)]">
        <section className="flex min-h-[550px] items-center justify-center overflow-hidden rounded-[26px] bg-[#e9e2d8] p-4 sm:p-8">
          <div className="relative w-full max-w-[390px]" ref={(el) => { if (el) el.dataset.canvas = 'true'; }}>
            <FramePreview photos={booth.slots.map((s) => s.photoUrl ?? '')} layout={custom.layout} mode={custom.mode} caption={custom.caption} frameColor={colors} filter={custom.filter} frameType={custom.frameType} showDate={custom.showDate} />
            {custom.objects.map((object) => <button key={object.id} className="absolute z-10 cursor-move touch-none rounded-md border border-dashed border-[#e5786a] bg-[#fffdf8]/75 px-2 py-1 text-sm" style={{ left: `${object.x*100}%`, top: `${object.y*100}%`, transform: `translate(-50%,-50%) rotate(${object.rotation}deg)`, color: object.color }} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); const rect = event.currentTarget.parentElement?.getBoundingClientRect(); if (rect) { setHistory((items) => [...items.slice(-19), custom]); setRedoHistory([]); dragRef.current = { id: object.id, x: event.clientX, y: event.clientY, originX: object.x, originY: object.y, rect }; } }} onPointerMove={moveObject} onPointerUp={() => { dragRef.current = null; setDirty(true); }}>{object.label}</button>)}
          </div>
        </section>
        <section className="paper-card rounded-[22px] p-4 sm:p-6">
          <div role="tablist" aria-label="Customization tools" className="mb-5 flex flex-wrap gap-1 rounded-xl bg-[#f0ebe3] p-1">{(['Layout','Frame','Filter','Stickers','Text'] as const).map((item) => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-11 flex-1 rounded-lg px-2 text-xs font-semibold sm:text-sm ${tab === item ? 'bg-[#fffdf8] shadow-sm' : 'text-[#756f66]'}`}>{item}</button>)}</div>
          {tab === 'Layout' && <div><h2 className="serif text-2xl">Arrange the moments</h2><p className="text-sm text-[#6f685f]">Changing the layout keeps every caption and decoration.</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{layouts.map(([key,label]) => <button key={key} onClick={() => update({ layout: key as CustomizationInput['layout'] })} aria-pressed={custom.layout === key} className={`min-h-12 rounded-xl border p-2 text-sm ${custom.layout === key ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5]'}`}>{label}</button>)}</div><label className="mt-5 flex min-h-12 items-center justify-between rounded-xl border border-[#d9d1c5] px-4 text-sm"><span>Scrapbook paper style</span><input type="checkbox" checked={custom.mode === 'scrapbook'} onChange={(e) => update({ mode: e.target.checked ? 'scrapbook' : 'classic' })} /></label></div>}
          {tab === 'Frame' && <div><h2 className="serif text-2xl">Give it a border</h2><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{(['clean','black','solid','polaroid','film','torn','pattern'] as const).map((item) => <button key={item} aria-pressed={custom.frameType === item} onClick={() => update({ frameType: item })} className={`min-h-12 rounded-xl border capitalize ${custom.frameType === item ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{item}</button>)}</div><p className="field-label mt-6">Paper color</p><div className="flex flex-wrap gap-3">{frameColors.map((color) => <button key={color} aria-label={`Frame color ${color}`} aria-pressed={custom.frameColor.toLowerCase() === color.toLowerCase()} onClick={() => update({ frameColor: color })} className={`size-11 rounded-full border ${custom.frameColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-[#292723] ring-offset-2' : 'border-[#bcb3a7]'}`} style={{ backgroundColor: color }} />)}</div><label className="mt-5 flex min-h-12 items-center justify-between rounded-xl border border-[#d9d1c5] px-4 text-sm">Show date <input type="checkbox" checked={custom.showDate} onChange={(e) => update({ showDate: e.target.checked })} /></label></div>}
          {tab === 'Filter' && <div><h2 className="serif text-2xl">A little atmosphere</h2><div className="mt-4 grid grid-cols-3 gap-2">{filters.map(([value,label],i) => <button key={value} aria-pressed={custom.filter === value} onClick={() => update({ filter: value })} className={`min-h-[76px] rounded-xl border p-2 text-center ${custom.filter === value ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}><span className={`mx-auto mb-2 block h-8 w-11 rounded-md ${['bg-[#9fb9c7]','bg-[#999] grayscale','bg-[#d7b69b]','bg-[#b7cce0]','bg-[#e8ded0]'][i%5]}`} /><span className="text-xs">{label}</span></button>)}</div></div>}
          {tab === 'Stickers' && <div><h2 className="serif text-2xl">Add a tiny flourish</h2><p className="text-sm text-[#6f685f]">Pick one, then drag it anywhere on the paper.</p><div className="grid grid-cols-2 gap-2">{[['✦','Little star'],['♥','Heart'],['✿','Bloom'],['⌁','Doodle'],['TAPE','Tape'],['✎','Note']].map(([symbol,label]) => <button key={label} onClick={() => addObject('sticker',symbol)} className="min-h-[56px] rounded-xl border border-[#d9d1c5] bg-[#fffdf8] text-sm"><span className="mr-2 text-lg text-[#e5786a]">{symbol}</span>{label}</button>)}</div>{custom.objects.filter((o) => o.kind === 'sticker').map((o) => <button key={o.id} onClick={() => update({ objects: custom.objects.filter((item) => item.id !== o.id) })} className="button-quiet mt-3 inline-flex items-center gap-1"><Trash2 size={14} /> Remove {o.label}</button>)}</div>}
          {tab === 'Text' && <div><h2 className="serif text-2xl">The words that stay</h2><label className="field-label mt-4" htmlFor="artifact-caption">Caption</label><input id="artifact-caption" className="input-paper" maxLength={120} value={custom.caption ?? ''} placeholder="A little note for later…" onChange={(e) => update({ caption: e.target.value })} /><Button variant="secondary" className="mt-4" onClick={() => addObject('text','your note')}>Add movable text</Button><div className="mt-5 space-y-2">{custom.objects.filter((o) => o.kind === 'text').map((o) => <div key={o.id} className="flex items-center gap-2"><input aria-label="Editable artwork text" className="input-paper" value={o.label} onChange={(e) => update({ objects: custom.objects.map((item) => item.id === o.id ? { ...item, label: e.target.value.slice(0,120) } : item) })} /><button aria-label="Remove text object" className="button-quiet" onClick={() => update({ objects: custom.objects.filter((item) => item.id !== o.id) })}><Trash2 size={16} /></button></div>)}</div></div>}
          {!creatorToken && <p role="alert" className="mt-5 rounded-xl bg-[#f2e5d8] p-3 text-sm text-[#6f5147]">This device doesn’t have the creator key. Open the editor on the device that created this booth to save changes.</p>}
          {save.isError && <div className="mt-4"><ErrorNote message={getError(save.error)} /></div>}
          <div className="mt-6 flex items-center justify-between border-t border-[#e4ddd3] pt-4 text-xs text-[#756f66]"><span>{save.isPending ? 'Saving…' : dirty ? 'Changes save as you go' : 'All changes saved'}</span><button className="underline" disabled={!creatorToken} onClick={() => { update(defaultCustomization(booth)); }}>Reset to original</button></div>
        </section>
      </div>
    </div>
  </Shell>;
}

const previewKey = (token: string) => `tc-preview:${token}`;

export function CreatorStylePage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const query = useBooth(privateToken);
  const booth = query.data;
  const creatorToken = localStorage.getItem(creatorKey(privateToken)) ?? '';
  const save = useSaveBoothCustomization({ request: { headers: { 'X-Creator-Token': creatorToken } } });
  const creatorPreview = sessionStorage.getItem(previewKey(privateToken)) ?? '';
  const [frameType, setFrameType] = useState<CustomizationInput['frameType']>('clean');
  const [frameColor, setFrameColor] = useState('#FFFDF8');
  const [filter, setFilter] = useState<CustomizationInput['filter']>('original');

  useEffect(() => {
    if (booth) {
      setFrameType(booth.customization?.frameType ?? 'clean');
      setFrameColor(booth.customization?.frameColor ?? '#FFFDF8');
      setFilter(booth.customization?.filter ?? 'original');
    }
  }, [booth]);

  const photos = useMemo(() => {
    if (!booth) return [];
    return booth.slots.map((slot, i) => {
      if (slot.photoUrl) return slot.photoUrl;
      if (i === 0 && creatorPreview) return creatorPreview;
      return '';
    });
  }, [booth, creatorPreview]);

  const done = async () => {
    if (!creatorToken || !booth) return;
    const data: CustomizationInput = {
      mode: booth.customization?.mode ?? booth.mode,
      layout: booth.customization?.layout ?? booth.layout,
      frameType,
      frameColor,
      filter,
      showDate: booth.customization?.showDate ?? true,
      caption: booth.customization?.caption ?? '',
      objects: booth.customization?.objects ?? [],
    };
    try {
      const saved = await save.mutateAsync({ privateToken, data });
      queryClient.setQueryData<BoothState>(getGetBoothQueryKey(privateToken), (old) => old ? { ...old, customization: saved } : old);
      sessionStorage.removeItem(previewKey(privateToken));
      navigate(`/booth/${privateToken}`);
    } catch { /* Error shown via save.isError */ }
  };

  if (query.isLoading || !booth) return <Shell><TopBar /><div className="mx-auto max-w-4xl py-12"><BoothLoading error={query.error} retry={() => void query.refetch()} /></div></Shell>;
  if (!creatorToken) return <Shell><TopBar /><div className="mx-auto max-w-lg py-12"><Panel><h1 className="serif text-3xl">Creator access needed.</h1><p className="text-[#6f685f]">Open this page on the device where you created the booth.</p><Button onClick={() => navigate(`/booth/${privateToken}`)}>Back to booth</Button></Panel></div></Shell>;

  return <Shell><TopBar right={<span className="eyebrow">Style your booth</span>} />
    <div className="mx-auto max-w-[1100px] py-6">
      <div className="mb-5"><p className="eyebrow">Almost there</p><h1 className="serif mt-1 text-4xl">Pick a look for your booth.</h1></div>
      <div className="grid gap-6 lg:grid-cols-[minmax(320px,1fr)_minmax(300px,.85fr)]">
        <section className="flex min-h-[480px] items-center justify-center overflow-hidden rounded-[26px] bg-[#e9e2d8] p-4 sm:p-8">
          <div className="w-full max-w-[390px]">
            <FramePreview photos={photos} layout={booth.customization?.layout ?? booth.layout} mode={booth.customization?.mode ?? booth.mode} caption={booth.customization?.caption} frameColor={frameColor} filter={filter} frameType={frameType} showDate={booth.customization?.showDate} />
          </div>
        </section>
        <section className="paper-card rounded-[22px] p-4 sm:p-6">
          <div>
            <h2 className="serif text-2xl">Frame style</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{(['clean','black','solid','polaroid','film','torn','pattern'] as const).map((item) => <button key={item} aria-pressed={frameType === item} onClick={() => setFrameType(item)} className={`min-h-12 rounded-xl border capitalize ${frameType === item ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}>{item}</button>)}</div>
          </div>
          <div className="mt-6">
            <p className="field-label">Paper color</p>
            <div className="flex flex-wrap gap-3">{frameColors.map((color) => <button key={color} aria-label={`Frame color ${color}`} aria-pressed={frameColor.toLowerCase() === color.toLowerCase()} onClick={() => setFrameColor(color)} className={`size-11 rounded-full border ${frameColor.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-[#292723] ring-offset-2' : 'border-[#bcb3a7]'}`} style={{ backgroundColor: color }} />)}</div>
          </div>
          <div className="mt-6">
            <h2 className="serif text-2xl">Filter</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">{filters.map(([value,label],i) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-[68px] rounded-xl border p-2 text-center ${filter === value ? 'border-[#292723] bg-[#292723] text-white' : 'border-[#d9d1c5] bg-[#fffdf8]'}`}><span className={`mx-auto mb-1 block h-7 w-10 rounded-md ${['bg-[#9fb9c7]','bg-[#999] grayscale','bg-[#d7b69b]','bg-[#b7cce0]','bg-[#e8ded0]'][i%5]}`} /><span className="text-xs">{label}</span></button>)}</div>
          </div>
          {save.isError && <div className="mt-4"><ErrorNote message={getError(save.error)} /></div>}
          <Button className="mt-6 w-full" disabled={save.isPending} onClick={() => void done()}>{save.isPending ? <><LoaderCircle className="animate-spin" /> Saving…</> : <>Done <Check size={17} /></>}</Button>
        </section>
      </div>
    </div>
  </Shell>;
}

export function NotificationsPage() {
  const { privateToken = '' } = useParams<{privateToken:string}>();
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
  return <Shell><TopBar right={<span className="eyebrow">Notifications</span>} /><div className="mx-auto max-w-[650px] py-10 sm:py-14">
    {confirmed && <div className="mb-5 rounded-2xl border border-[#c3d9cf] bg-[#e6f0eb] p-4 text-sm text-[#435c50]"><strong>Your frame is safely tucked away.</strong> It won’t be seen until everyone has confirmed.</div>}
    <Panel><p className="eyebrow text-[#e5786a]">✦ keep the link close</p><h1 className="serif mt-2 text-4xl sm:text-5xl">Come back when the booth is ready.</h1><p className="mt-3 leading-7 text-[#6f685f]">If you’d like, this device can let you know when the keepsake opens. You can also just keep the private link—no app or account needed.</p>
      <div className="mt-6 rounded-2xl bg-[#f0ebe3] p-5"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#dce8e3]"><Heart size={20} /></span><div><strong>Keep your private link</strong><p className="mb-0 text-sm text-[#6f685f]">Anyone with the link can see the booth when it’s ready.</p></div></div><div className="mt-4 flex flex-wrap gap-3"><CopyButton text={url}><Link2 size={16} /> Copy booth link</CopyButton><a className="button-secondary inline-flex items-center no-underline" href={url}>Open booth</a></div></div>
      <div className="mt-5 rounded-2xl border border-[#e2dbd1] p-5"><h2 className="serif text-2xl">A gentle nudge on this device</h2><p className="text-sm leading-6 text-[#6f685f]">Notifications are optional. We’ll only ask after you choose, and only once a frame is confirmed. The private link always works as a fallback.</p><Button variant="secondary" disabled={!canOptIn || !pushSupported || !accessToken || isSubscribed || subscribeToReady.isPending} onClick={() => void setup()}>{subscribeToReady.isPending ? 'Setting up…' : isSubscribed ? 'Notifications set up' : !pushSupported ? 'Use the private link instead' : !canOptIn ? 'Available after frame confirmation' : 'Enable notifications'}</Button>{!canOptIn && <p className="mt-2 text-xs text-[#6f685f]">Finish your frame first. You can choose notifications after it is safely confirmed.</p>}{!pushSupported && <p className="mt-2 text-xs text-[#6f685f]">This browser needs service worker, push, notification support, and a configured public key. Save the private link instead.</p>}{status && <p role="status" className="mt-3 text-sm text-[#6f685f]">{status}</p>}{permission === 'denied' && <p className="mt-2 text-xs text-[#6f685f]">Your browser has notifications blocked. The private link works just as well.</p>}</div>
      <details className="mt-4 rounded-xl border border-[#e2dbd1] p-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Add this booth to your Home Screen</summary><p className="mb-3 text-sm leading-6 text-[#6f685f]">On iPhone or iPad, open this link in Safari, tap Share, then choose “Add to Home Screen.” On Android, open the browser menu and choose “Install app” or “Add to Home screen.”</p><Button variant="secondary" onClick={() => void install()}>{installPrompt ? 'Install Timecapsule' : 'Show install instructions'}</Button></details>
      {query.data?.revealAvailable && <a className="button-primary mt-6 inline-flex items-center no-underline" href={`/booth/${privateToken}/reveal`}>See the finished keepsake <ArrowRight size={17} /></a>}
    </Panel>
  </div></Shell>;
}
