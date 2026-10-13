# Timecapsule — PRD addendum: PWA, notifications, editor interactions, and reveal motion

**Status:** Approved product-direction addition  
**Applies to:** Timecapsule PRD v0.1  

## Product behavior added

### Post-confirmation state

After a participant confirms and successfully uploads a frame, the app must show a durable success state before they leave:

- Confirm that the upload completed.
- Reiterate that their frame remains hidden until the reveal.
- Show completed/remaining participant progress without exposing photos.
- Tell the participant they may safely close the app.
- Offer a return to the waiting room.
- Offer an optional booth-ready notification.

### Installable PWA and Web Push

Timecapsule should be installable as a Progressive Web App. It must include a Web App Manifest, service worker, icons, standalone presentation, theme colors, and offline-safe shell behavior for previously opened booth status pages.

Notification permission must not be requested on landing or invitation entry. It may be requested only after a user explicitly chooses **Notify me when it's ready**, following successful frame confirmation or from the waiting room.

The app must:

- Explain any Add to Home Screen requirement before requesting permission.
- Use feature detection and provide a private-link fallback when push is unsupported or denied.
- Scope each subscription to the relevant private booth and authorized user/participant token.
- Deliver at most one booth-complete notification per subscription.
- Open the private reveal route when the notification is tapped.
- Remove or expire subscriptions after delivery, booth deletion, or booth expiry.
- Avoid reminder spam, promotional notifications, streaks, or unrelated messages.

Suggested notification copy:

> **Your booth is ready ✦**  
> Four time zones, still us is complete. Tap to watch the photostrip print.

### Physical photostrip reveal

The final reveal should feel like a physical photobooth print emerging from a slot.

- The strip begins masked behind a dark printer slot.
- It travels downward from `translateY(-110%)` to its final position.
- Anticipation delay: 180 ms.
- Main duration: 1100 ms.
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)`.
- Final settle: subtle 8 px overshoot with no repeating bounce.
- Paper shadow strengthens as the strip emerges.
- Title and actions fade in only after the strip settles.
- Users can skip and replay the reveal.
- The animation runs automatically only once per reveal visit.
- Reduced-motion mode replaces the translation with a 180 ms fade to the completed strip.

### Direct-manipulation editor

Stickers and text are not fixed decorations. They are selectable canvas objects.

Sticker behavior:

- Browse categorized sticker packs.
- Tap a sticker to insert it at the canvas center.
- Drag, resize, rotate, duplicate, flip when relevant, reorder, and delete.
- Display a clear selected-object boundary and touch-friendly handles.

Text behavior:

- Add title, group name, participant names, date, location, caption, or handwritten note.
- Double-tap to edit text.
- Change font pairing, size, color, alignment, rotation, and optional curved treatment.
- Drag, resize, layer, duplicate, and delete using the same selection model as stickers.

Layout behavior:

- Available layouts: vertical strip, horizontal strip, double strip, grid, editorial collage, and freeform scrapbook.
- Changing layout must preserve photos, filters, stickers, captions, and text.
- Reflow objects automatically and warn only when the new layout will crop an item.
- Undo/redo must cover insertion, transformation, deletion, and layout changes.

## New functional requirements

- **FR-045:** The app must show upload success only after the confirmed frame is durably stored.
- **FR-046:** A participant must be able to leave after upload and return through the same private link without losing state.
- **FR-047:** The app must be installable as a PWA on compatible platforms.
- **FR-048:** Notification permission must be requested only after a direct user action.
- **FR-049:** An opted-in user must receive at most one booth-ready notification for the relevant booth.
- **FR-050:** Tapping the notification must open the authorized reveal route.
- **FR-051:** The reveal must include the specified photostrip-print motion and a reduced-motion alternative.
- **FR-052:** Stickers and text must support move, resize, rotate, layer, duplicate, and delete operations.
- **FR-053:** Switching layouts must preserve existing artifact content and customization state.
- **FR-054:** Editor changes must autosave and support undo/redo.

## Acceptance criteria

- The post-upload state accurately distinguishes uploading, uploaded, and failed states.
- Closing and reopening the PWA preserves the participant's completed state.
- A permitted push subscription receives exactly one completion notification.
- A denied or unsupported notification permission leaves the product usable through the private link.
- Notification taps route to the correct private booth reveal.
- The print animation begins behind the slot, completes cleanly, can be skipped/replayed, and does not loop.
- Reduced-motion users receive an immediate, legible reveal without large translation.
- Sticker and text transforms work with touch, pointer, and keyboard-accessible alternatives.
- Changing layouts does not remove photos or decorations.
