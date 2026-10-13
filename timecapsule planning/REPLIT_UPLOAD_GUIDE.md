# Timecapsule — Replit upload guide

## What to upload

Upload the entire `timecapsule-replit-handoff` folder, or upload its ZIP and ask Replit to extract it. The most important files are:

1. `TIMECAPSULE_REPLIT_BUILD_PROMPT.md`
2. `TIMECAPSULE_PRD.md`
3. `TIMECAPSULE_PRD_ADDENDUM_PWA_MOTION.md`
4. `timecapsule-figma-board.svg`
5. `timecapsule-reveal-motion.svg`
6. `design-tokens.json`
7. `timecapsule-app-icon.svg`

The PNG design board is a quick preview. The four images in `references/` are mood references only and should not be copied literally.

## What to paste into Replit

Attach the files first. Then paste the complete contents of `TIMECAPSULE_REPLIT_BUILD_PROMPT.md` into Replit Agent.

If Replit asks whether to begin with a prototype or production integrations, tell it:

> Build the complete UI and happy path first using the isolated demo-data adapter, then add the supplied Supabase schema and production adapter. Do not stop at a static prototype.

## Review checkpoints

Ask Replit to show you these flows before considering the first build complete:

- Create a four-person booth and copy the private invitation link.
- Join from another browser session, claim a slot, upload or capture a frame, retake it, and confirm it.
- See the upload-complete/waiting state without revealing anyone's photos.
- Complete all demo slots and watch the photostrip print downward.
- Change the layout without losing photos, stickers, or text.
- Move, resize, rotate, layer, duplicate, and delete a sticker and a text object.
- Download both social and print PNGs.
- Install the PWA and exercise the notification opt-in path or its clearly labeled local demo.

Do not add Supabase or Web Push secrets until the local happy path is working and the `.env.example` file exists.
