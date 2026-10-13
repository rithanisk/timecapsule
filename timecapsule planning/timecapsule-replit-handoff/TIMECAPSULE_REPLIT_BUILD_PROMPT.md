# Timecapsule — Replit master build prompt

You are the lead product engineer and UI engineer for **Timecapsule**, a mobile-first asynchronous photobooth for friends, partners, and families who live in different places or time zones. Build a complete, working MVP—not a static mockup or disconnected set of screens.

Before writing code, inspect every attached file. Use them together in this priority order:

1. `TIMECAPSULE_PRD.md` — authoritative product scope and behavior.
2. `TIMECAPSULE_PRD_ADDENDUM_PWA_MOTION.md` — newer requirements that override the PRD if they differ.
3. `timecapsule-figma-board.svg` — authoritative visual and screen-flow reference. Use the PNG only as a quick preview; inspect the SVG for detail.
4. `timecapsule-reveal-motion.svg` — motion reference for the live-print reveal.
5. `design-tokens.json` and `timecapsule-app-icon.svg` — starter brand assets.
6. Files in `references/` — visual mood only. Do not copy any visible third-party logo, brand name, or photographed person into the product.

First summarize your implementation plan in a short checklist, then build it. Make reasonable decisions without repeatedly asking questions. If a credential is unavailable, implement a clearly isolated local/mock adapter and continue; do not stop at setup instructions.

The emotional promise is: **“Different places. One photobooth.”** The product should feel like an analog photobooth mixed with an editorial scrapbook. Keep the app interface quiet, warm, and easy to understand; let the final artifact carry the personality.

## First release scope

Implement a working responsive web app for 2–6 participants with:

- A landing page with the emotional proposition and a primary **Create a booth** action.
- A booth builder for name, subtitle, occasion, participant count, named/open slots, participant names, prompt, countdown, reveal behavior, layout, and style preset.
- Two visual modes: **Classic Booth** and **Scrapbook Booth**.
- Layouts: classic vertical strip, horizontal strip, double strip, grid, editorial collage, and freeform scrapbook. Recommend compatible layouts based on participant count.
- Camera capture with `getUserMedia`, front/rear camera switch, mirror preview, visible countdown, framing guide, retake, confirm, and file-upload fallback.
- A private invitation URL. Participants join without an account, claim a slot, capture one frame, review it, and confirm it.
- A waiting room that shows participant/slot completion without revealing submitted photos.
- After confirming a photo, a participant sees an explicit upload-success state, can safely leave, and can return to the waiting room at any time.
- An installable PWA with an optional one-time Web Push notification when the booth becomes ready.
- A final reveal after all required frames are complete, introduced by a physical photostrip-printing animation with reduced-motion support.
- A customization editor with five tabs: **Layout, Frame, Filter, Stickers, Text**.
- Downloadable social and print PNG output.

Never expose private photos through a public feed. Never upload a retake or rejected camera frame. Never automatically publish or submit anything on a user’s behalf.

## Customization behavior

The editor must support:

- Photo controls: crop, zoom, rotate, replace, retake, swap order, mirror, per-photo filter, and z-order in scrapbook mode.
- Frame types: clean white, black, solid color, Polaroid, film, torn paper, and subtle pattern.
- Frame colors from a curated palette, plus a custom color input.
- Filters: Original, Soft B&W, High-contrast B&W, Warm Film, Cool Flash, Faded, Disposable, Sepia, and Grain.
- Stickers: tape, pins, stars, bows, hearts, doodles, stamps, flowers, friendship, birthday, travel, and seasonal packs.
- Text: title, booth name, subtitle, participant names, date, location, caption, and a short handwritten-style note.
- Sticker and text objects that can be moved, resized, rotated, layered, duplicated, and deleted.
- Autosave while editing and undo/redo for customization actions.

### Direct manipulation rules

- Choosing a sticker pack opens a browsable sticker tray. Tapping a sticker inserts it at the center of the artifact and selects it.
- Selected stickers and text show a visible bounding box with touch-friendly handles for resize and rotation.
- A selected object can be dragged anywhere within the safe canvas, duplicated, flipped where relevant, moved forward/backward, or deleted.
- Double-tapping text enters editing. Text controls include font pairing, size, color, alignment, rotation, and optional curved-text treatment.
- Layout changes preserve all photos, stickers, and text. Reflow content to the new template without silently deleting or resetting edits; warn only when an item will be cropped.

Keep creation fast: start with complete presets, then expose the detailed controls. Customization should add emotional specificity without becoming a professional design tool.

## Waiting, PWA, and notification behavior

- Immediately after a frame upload succeeds, show **“You're in”**, explain that the photo is uploaded and hidden, show group completion progress, and tell the participant they may leave.
- Offer **Notify me when it's ready** only after successful confirmation. Do not request notification permission on initial page load.
- Make the app installable with a Web App Manifest, appropriate icons, `display: standalone`, theme colors, and a service worker.
- On platforms where installation is required for push, explain **Add to Home Screen** before requesting notification permission.
- The permission request must follow a direct user gesture. Permission is optional; if declined, preserve the private return link as the fallback.
- Store a push subscription scoped to the private booth and participant/creator token. Expire or remove it after the booth-ready notification is delivered or the booth is deleted.
- Send at most one completion notification per booth subscription: **“Your booth is ready ✦ Four time zones, still us is complete. Tap to watch the photostrip print.”**
- Tapping the notification opens the private reveal route. Use feature detection rather than browser detection.
- Add app-icon badging when supported and clear it when the reveal is opened.

Web Push should use the Push API, Notifications API, and service worker. On iPhone and iPad, clearly communicate when the user must first install the PWA to the Home Screen. Notification permission must always be user initiated.

## Reveal animation

When the completed reveal opens, present the artifact like a physical photobooth strip printing from a dark slot:

- Keep the top of the strip masked behind the printer slot.
- Animate the strip downward from `translateY(-110%)` to its resting position.
- Start after a 180 ms anticipation delay.
- Duration: 1100 ms.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Add a subtle 8 px settling overshoot without a repeated bounce.
- Increase the paper shadow gradually as more of the strip appears.
- Keep the title and actions hidden until the strip settles, then fade them in over 220 ms.
- Include a **Replay reveal** control.
- Under `prefers-reduced-motion: reduce`, skip the translation and display the completed strip with a short 180 ms opacity fade.
- Do not loop the reveal automatically and do not block the user from skipping it.

## Visual system

- Background/paper: `#FBF7F0`
- Ink: `#292723`
- Coral accent: `#E5786A`
- Sage accent: `#A9C7BD`
- Sky accent: `#AFC4E6`
- Warm yellow accent: `#EBCB8B`
- Functional type: Inter or a close neutral sans-serif.
- Emotional headings/captions: Georgia or a close editorial serif.
- Rounded mobile surfaces, quiet 1px warm-gray borders, restrained shadows, sparse paper texture.
- Minimum 44px touch targets and WCAG AA contrast.
- Avoid generic dashboard styling, glossy gradients, social engagement patterns, or overly sentimental copy.

## Suggested implementation

- Next.js App Router with strict TypeScript and Tailwind CSS.
- Supabase Postgres, Storage, and Realtime.
- Browser `MediaDevices.getUserMedia()` for capture.
- Canvas API for live composition and preview.
- Sharp on the server for canonical social and print exports.
- High-entropy private booth tokens and scoped participant claim tokens.
- Row-level security for booths, participant slots, and confirmed frames.
- A Web App Manifest, service worker, standards-based Web Push subscription flow, and a server endpoint or Supabase Edge Function for the booth-ready push.
- Motion.dev for the reveal when using React, or equivalent CSS keyframes if no motion library is installed.

Use mock/local data first if Supabase credentials are not present, but keep the data access layer isolated so it can be switched to Supabase without rewriting the UI.

Create `.env.example` with these names and never commit real secrets:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Add a `README.md` with local setup, Replit deployment, Supabase schema/migration steps, storage-bucket configuration, Web Push setup, and the limitations of iOS PWA notifications. The app must still run in a polished demo mode when these variables are missing.

## Privacy, safety, and robustness

- Keep booths private by default. Use unguessable tokens, scoped authorization, signed storage access, and row-level security.
- Validate file type, file size, image dimensions, and authorization on the server. Strip EXIF metadata before canonical export.
- Do not expose service-role or VAPID private keys to the browser.
- Store only confirmed captures. Retakes and rejected frames should remain local and be discarded.
- Add booth expiry/deletion behavior and remove associated media and push subscriptions.
- Handle double slot claims transactionally. Make final rendering idempotent.
- Provide explicit loading, offline, retry, permission-denied, upload-failed, camera-unavailable, and expired-link states.
- Avoid public feeds, follower mechanics, streaks, engagement bait, unnecessary analytics, or notification spam.

## Core data entities

- `Booth`: identity, participant count, layout, theme, prompt, countdown, reveal rule, status, timestamps, private token.
- `ParticipantSlot`: display name, position, claim status, claim token, timestamps.
- `Frame`: confirmed media path, dimensions, source, caption, deletion state.
- `Artifact`: booth version, social output, print output, render timestamp, customization snapshot.
- `PushSubscription`: scoped booth/user token, endpoint, encrypted subscription keys, permission state, delivered-at timestamp, and expiry.

## Required routes

- `/` — landing
- `/create` — booth builder
- `/booth/[privateToken]` — creator waiting/manage view
- `/join/[privateToken]` — invitation and slot claim
- `/join/[privateToken]/capture` — camera and review
- `/booth/[privateToken]/reveal` — completed artifact
- `/booth/[privateToken]/edit` — customization editor
- `/booth/[privateToken]/notifications` — PWA install and booth-ready notification opt-in

## Quality bar and acceptance tests

- A creator can configure a booth for 2–6 people and receive a private invitation URL.
- A participant can join without an account, claim one valid slot, capture or upload a photo, retake it, and confirm it.
- Confirmed frames remain hidden until the reveal rule is satisfied.
- After confirmation, the participant can close the app without losing progress and receives the booth-ready notification only if they opted in.
- Tapping the completion notification opens the correct private reveal route.
- The printing animation runs once, can be skipped or replayed, and respects reduced-motion preferences.
- Concurrent slot claims cannot complete the same slot twice.
- The final artifact reflects the selected layout, frame, colors, filters, stickers, text, participant order, labels, and date.
- The app has explicit camera-denied, unsupported-browser, poor-connection, retry, empty, and error states.
- Mobile layouts work at 360px width and scale cleanly to desktop.
- Keyboard navigation, focus states, reduced motion, and accessible labels are implemented.
- Stickers and text can be added, selected, dragged, resized, rotated, layered, duplicated, and deleted with touch and keyboard alternatives.
- Switching layouts preserves all existing photos, stickers, text, and edits.
- Social and print PNG downloads work.
- No precise location metadata is exposed in generated output.
- The project passes linting and type checking, and its critical happy path has automated tests.
- The service worker and manifest work in a production build served over HTTPS.

## Required delivery order

1. Scaffold the routes, design tokens, data interfaces, reusable components, manifest, and service-worker shell.
2. Implement the entire happy path end to end with demo persistence: create → invite → claim → capture/upload → confirm → wait → reveal → customize → download.
3. Make the camera, responsive editor, layout switching, SVG/canvas preview, print animation, and PNG export genuinely functional.
4. Add the Supabase schema, migrations, storage policies, Realtime updates, transactional slot claiming, and production adapter.
5. Add Web Push subscription and completion delivery with a safe demo fallback when push credentials are absent.
6. Finish empty/error/offline states, accessibility, reduced motion, tests, documentation, and deployment configuration.

Do not stop after generating the landing page. Continue until the complete happy path works. Keep the UI visually faithful to the supplied design board and preserve the warm, lightly playful product voice from the PRD. At the end, run the available lint, type-check, test, and production-build commands; fix failures; then report what works, what is using demo data, and which credentials are needed to enable production services.
