# Timecapsule — Product Requirements Document

**Version:** 0.1  
**Status:** Design-ready draft  
**Product type:** Mobile-first web application  
**Product name:** Timecapsule  
**Primary release:** MVP  

## 1. Product summary

Timecapsule is an asynchronous photobooth for people who cannot be in the same place at the same time.

One person creates and customizes a booth, takes the first photo, and invites other participants through a private link. Each participant takes their frame from wherever they are. When every required frame is complete, the application reveals one shared photostrip that can be downloaded and kept.

The product should create the emotional impression that several people briefly occupied the same playful space, even though their photographs were taken in different locations and time zones.

### Product promise

> Different places. One photobooth.

### Core product insight

Long-distance friends may still communicate regularly, but they stop producing new photographs together. Timecapsule creates new visual evidence that the friendship is still happening.

## 2. Problem

People in long-distance friendships face several related problems:

- Coordinating video calls across time zones requires planning and sustained attention.
- Social media provides updates but positions friends as an audience rather than active participants in a shared moment.
- Most remote-social products require a new posting habit.
- Friends accumulate individual photographs but stop creating new group photographs.
- Existing group photos increasingly represent the past rather than the current friendship.

### Problem statement

Long-distance friends need a lightweight way to create something together asynchronously because coordinating time is difficult, but passively observing one another online does not reproduce the feeling of sharing a moment.

## 3. Target users

### Primary user

A person aged approximately 18–35 who has close friends, a partner, or family members living in different cities or time zones and wants to create a shared keepsake without scheduling a live session.

### Secondary users

- Friends who live nearby but cannot attend the same event
- Couples in long-distance relationships
- Families distributed across countries
- Graduating classmates
- Remote teams celebrating a milestone
- Wedding parties, birthday groups, and reunion attendees

### Jobs to be done

- “When my friends and I live far apart, help us create a new photo together so our friendship does not exist only in old pictures.”
- “When I want to surprise someone, help me coordinate a meaningful visual gift without requiring everyone to be online simultaneously.”
- “When I receive a booth invitation, let me participate quickly without creating an account or learning a new social platform.”

## 4. Goals

### User goals

- Create a shared photostrip asynchronously.
- Customize the booth so it feels specific to the people and occasion.
- Participate in less than two minutes on a mobile device.
- Experience a satisfying group reveal.
- Download a high-quality artifact suitable for sharing or printing.

### Product goals

- Demonstrate the value of asynchronous co-creation.
- Make invitation-to-photo conversion frictionless.
- Support meaningful customization without turning creation into a design tool.
- Encourage completed booths rather than abandoned invitations.
- Produce a visually distinctive artifact users want to save.

### MVP success definition

The MVP succeeds if a creator can configure a booth for two to six people, invite participants, collect one frame from each person, reveal the completed strip, and download it without requiring participants to create accounts.

## 5. Non-goals for MVP

- Public profiles or follower systems
- A public discovery feed
- Direct messaging or group chat
- Live video calling
- AI-generated faces or backgrounds
- Beauty filters or facial modification
- Payments, subscriptions, or physical-print fulfillment
- Native iOS or Android applications
- Public comments or engagement counts
- Complex freeform graphic design
- Multiple simultaneous photos per participant
- Automated social-media publishing

## 6. Design principles

### Asynchronous by default

No participant should need to be online at the same time as another participant.

### Personal before polished

The result should feel specific to the group. It should not resemble a generic social-media template.

### Participation without administration

Invited participants should open a link, understand their task, take a frame, and finish. Only the creator manages the booth.

### Anticipation is part of the product

Unfinished frames should remain concealed until the configured reveal condition is met. The waiting period should create curiosity, not anxiety.

### No coercive engagement

Timecapsule will not use streaks, public participation scores, guilt-based reminders, or engagement bait.

### Privacy is visible

Every invitation and camera screen must explain who will be able to see the image and when it will be revealed.

## 7. Core experience

### Creator flow

1. The creator selects **Create a booth**.
2. The creator enters a booth name.
3. The creator selects the number of participants.
4. The creator optionally names or labels each participant slot.
5. The creator chooses a layout, visual theme, prompt, countdown, and reveal behavior.
6. The creator previews the empty photostrip.
7. The creator takes and confirms their own frame.
8. The application creates a private invitation link.
9. The creator shares the link through any messaging application.
10. The creator views progress as participants complete their frames.
11. The completed strip is revealed according to the selected reveal behavior.
12. The creator downloads or shares the final artifact.

### Participant flow

1. The participant opens the private link.
2. The invitation identifies the creator, booth name, participant count, prompt, and privacy state.
3. The participant claims their named slot or an available open slot.
4. The participant grants camera permission.
5. The participant views the framing guide and prompt.
6. The participant starts the countdown and takes a photo.
7. The participant retakes or confirms the frame.
8. The participant sees a completion message and the remaining number of unfilled frames.
9. The participant returns through the same link for the final reveal.

### Reveal flow

1. The final required participant confirms their frame.
2. The application locks the completed strip.
3. The reveal becomes available immediately or at the creator’s scheduled time.
4. Participants see a short, accessible reveal transition.
5. The full strip appears with the configured booth name, labels, theme, and date.
6. Authorized participants can download the artifact.

## 8. Customization system

Customization should create emotional specificity while keeping booth creation under three minutes.

### Booth identity

**Required**

- Booth name: 1–50 characters
- Participant count: 2–6 in MVP

**Optional**

- Short subtitle: up to 80 characters
- Occasion label: friendship, birthday, anniversary, graduation, reunion, family, team, or custom
- Date label: automatic, hidden, or custom
- Creator name displayed on invitation

### Participant configuration

- One required frame per participant in MVP
- Named slots or open slots
- Named slots support a display name of 1–30 characters
- Creator may reorder slots before invitations are sent
- Creator may reserve a slot for themselves
- Creator may replace an unclaimed named slot before completion
- Creator may reduce the participant count only when doing so does not remove a completed participant
- Creator may increase the count up to six before the booth is complete

### Layout

MVP layouts:

- Classic vertical strip
- Horizontal strip
- Two-column grid for four or six participants

Layout availability responds to participant count. The application should recommend a default that produces balanced dimensions.

Future layouts:

- Freeform collage
- Postcard
- Contact sheet
- Film roll
- Magazine cover

### Visual theme

MVP controls:

- Background color from a curated palette
- Frame color from a curated palette
- Light, dark, or paper texture treatment
- Square or softly rounded photo corners
- One of three typography pairings
- Optional decorative treatment: tape, marker, or clean

The application should provide complete presets before exposing individual controls. Each preset must maintain readable contrast.

### Prompt

The creator can choose a preset or write a custom prompt of up to 120 characters.

Initial presets:

- Look toward the next person
- Pass an imaginary object
- Make the same expression
- Show the most ordinary part of your day
- Recreate an old group photo
- Hold something that reminds you of us
- No prompt — just be yourself

### Capture configuration

- Countdown: 3, 5, or 10 seconds
- Camera: front-facing by default, with rear-camera switch
- Mirror preview: on by default for front-facing capture
- Final image should not be mirrored unless explicitly selected
- Framing guide: fit, close-up, or full-body suggestion
- Retakes: unlimited until confirmation
- Image orientation: portrait for classic strips, adaptive for grid layouts

### Reveal behavior

MVP options:

- Reveal when every required frame is complete
- Reveal at a creator-selected date and time after completion

Future options:

- Creator-triggered reveal
- Simultaneous live reveal room
- Individual frames remain hidden until all participants explicitly join the reveal

### Output configuration

- Download resolution: social and print-quality PNG
- Optional participant labels
- Optional date
- Optional product mark; unobtrusive and removable in future paid tiers
- No automatic public publishing

## 9. Functional requirements

### P0 — Booth creation

- **FR-001:** A user must be able to create a booth without installing an application.
- **FR-002:** A creator must enter a valid booth name.
- **FR-003:** A creator must select between two and six participants.
- **FR-004:** The application must create the corresponding number of participant slots.
- **FR-005:** The creator must be able to choose named or open slots.
- **FR-006:** The creator must be able to select a compatible layout and theme.
- **FR-007:** The creator must be able to preview the empty strip before confirming the booth.
- **FR-008:** The application must generate an unguessable private invitation URL.

### P0 — Camera capture

- **FR-009:** The application must request camera permission only when capture is initiated.
- **FR-010:** The camera screen must display the booth prompt and framing guide.
- **FR-011:** The participant must be able to switch supported cameras.
- **FR-012:** The participant must be able to trigger the configured countdown.
- **FR-013:** The participant must be able to retake a photo before confirming it.
- **FR-014:** A frame must not upload until the participant confirms it.
- **FR-015:** The application must prevent accidental submission of an empty or corrupted image.
- **FR-016:** The application must provide a file-upload fallback when camera access is unavailable.

### P0 — Participation

- **FR-017:** Participants must be able to join through an invitation link without creating an account.
- **FR-018:** A participant must claim an available slot before capture.
- **FR-019:** The application must prevent two people from completing the same slot.
- **FR-020:** A named participant must be able to select only their intended slot unless the creator changes the assignment.
- **FR-021:** The invitation must show who created the booth and who can see the resulting image.
- **FR-022:** A participant must explicitly confirm their frame before it becomes part of the booth.

### P0 — Waiting and completion

- **FR-023:** Authorized users must be able to see completion progress without seeing hidden frames.
- **FR-024:** Hidden frames must use neutral placeholders rather than blurred participant images.
- **FR-025:** The application must detect when every required slot is complete.
- **FR-026:** The application must apply the configured reveal rule after completion.
- **FR-027:** The application must generate the final artifact consistently across supported browsers.
- **FR-028:** Authorized users must be able to download the completed strip as a PNG.

### P0 — Creator controls

- **FR-029:** The creator must be able to regenerate the invitation link, invalidating the previous link.
- **FR-030:** The creator must be able to remove and reopen an individual participant slot before final reveal.
- **FR-031:** Removing a submitted frame must require explicit confirmation.
- **FR-032:** The creator must be able to delete the entire booth.
- **FR-033:** The application must clearly explain that deletion is permanent.

### P1 — Sharing and reminders

- **FR-034:** The creator should be able to copy the invitation link with one action.
- **FR-035:** The application should support the device share sheet when available.
- **FR-036:** The creator should be able to copy a gentle reminder message for incomplete participants.
- **FR-037:** Participants should be able to opt into a reveal-ready email notification.

### P1 — Final customization

- **FR-038:** The creator should be able to edit the booth name, subtitle, labels, and date before downloading.
- **FR-039:** The creator should be able to choose among supported output aspect ratios.
- **FR-040:** The creator should be able to generate an alternative theme without retaking photographs.

### P2 — Future collaboration

- **FR-041:** Participants may add short captions to their own frames.
- **FR-042:** The creator may create multiple rounds within one booth.
- **FR-043:** Participants may join a synchronized reveal room.
- **FR-044:** Users may order a physical print.

## 10. Screen requirements

### Landing page

Purpose: communicate the emotional proposition and begin creation.

Required elements:

- Product promise
- Example completed strip
- **Create a booth** action
- **Join with a link** is handled by direct routing rather than a code field in MVP
- Concise privacy statement

### Booth builder

Purpose: customize the experience without overwhelming the creator.

Structure:

1. Name and occasion
2. People and slot labels
3. Layout and theme
4. Prompt and countdown
5. Reveal behavior
6. Live preview

The live preview should update immediately as configuration changes.

### Invitation page

Purpose: establish trust and set expectations before camera permission.

Required information:

- Creator’s display name
- Booth name
- Prompt
- Claimed and available slots
- What will happen to the participant’s photo
- Who can access the completed strip
- Approximate participation time

### Camera screen

Purpose: make capture playful and understandable.

Required elements:

- Camera preview
- Prompt
- Framing overlay
- Countdown control
- Camera switch
- Permission and troubleshooting states

### Review screen

Purpose: give the participant control over what is submitted.

Required actions:

- Retake
- Confirm frame
- Optional mirror toggle where technically supported
- Privacy reminder

### Waiting room

Purpose: maintain anticipation while communicating progress.

Required elements:

- Completed participant names or slot labels
- Hidden placeholders for completed frames
- Remaining slot count
- Copy invitation link for the creator
- Return-later instruction for participants

### Reveal screen

Purpose: deliver the emotional payoff.

Required elements:

- Completed strip
- Booth name and optional subtitle
- Participant labels if enabled
- Date if enabled
- Download action
- Share-link action
- Creator-only edit action

## 11. Key states and edge cases

### Camera permission denied

- Explain how to enable access in the current browser.
- Offer file upload as a fallback.
- Preserve the claimed slot for a limited period.

### Camera unavailable

- Detect missing compatible input.
- Offer file upload.
- Do not block the entire booth.

### Participant abandons capture

- Release an open slot after 15 minutes of inactivity.
- Named slots remain reserved.

### Two participants claim the same open slot

- Resolve claims transactionally on the server.
- The second participant receives the next available slot.

### Invitation link is leaked

- Creator can regenerate the link.
- Optional creator approval is a future control.

### Participant wants to replace a submitted frame

- Before reveal, the creator can reopen the slot.
- After reveal, replacing a frame creates a new artifact version and invalidates the previous download link where possible.

### Booth never completes

- Creator can remove an unfilled slot if no completed frame will be lost.
- Booth remains available until its retention expiry.
- No guilt-based notifications are sent.

### Unsupported browser

- Explain the limitation.
- Offer file upload when feasible.
- Recommend current iOS Safari, Android Chrome, or desktop Chromium without blocking compatible alternatives.

### Poor connection

- Compress uploads on the client while preserving printable output.
- Show upload progress.
- Allow retry without retaking the photo.

### Scheduled reveal time precedes completion

- Reveal occurs as soon as all required frames are completed after the scheduled time.

## 12. Privacy and safety requirements

- Booths are private and unindexed by default.
- Invitation URLs must contain high-entropy tokens.
- The application must use encrypted transport for all media and metadata.
- Raw camera frames that are rejected or retaken must not be uploaded.
- Participants must see the intended audience before capture.
- The creator must be able to delete an individual frame or entire booth.
- Deleted media must be removed from active storage within a defined operational window.
- No facial recognition, biometric classification, or identity inference is permitted.
- No training of models on user photographs is permitted without separate, explicit consent.
- Photo metadata unnecessary for product behavior, especially precise location, should be stripped from generated outputs.
- Booth content should expire after 90 days in MVP unless the creator explicitly chooses to retain it.
- Downloaded artifacts are outside the application’s deletion control; the interface must state this clearly.

## 13. Accessibility requirements

- Every interactive control must be keyboard accessible.
- Color cannot be the only indicator of slot or completion state.
- Text and controls must meet WCAG AA contrast targets.
- Camera instructions must be available as text.
- Countdown must include visual and non-audio cues.
- Reveal animation must respect reduced-motion preferences.
- Layout previews require descriptive labels.
- Touch targets should be at least 44 by 44 CSS pixels.
- Error messages must identify the problem and the corrective action.

## 14. Data model

### Booth

- `id`
- `private_token`
- `creator_id` or anonymous creator token
- `name`
- `subtitle`
- `occasion`
- `participant_count`
- `layout`
- `theme`
- `prompt`
- `countdown_seconds`
- `reveal_mode`
- `scheduled_reveal_at`
- `status`: draft, collecting, complete, revealed, expired, deleted
- `created_at`
- `completed_at`
- `expires_at`

### Participant slot

- `id`
- `booth_id`
- `position`
- `display_name`
- `claim_token`
- `claim_status`: open, claimed, submitted, reopened
- `claimed_at`
- `submitted_at`

### Frame

- `id`
- `slot_id`
- `media_path`
- `thumbnail_path`
- `width`
- `height`
- `capture_source`: camera or upload
- `caption`
- `confirmed_at`
- `deleted_at`

### Artifact

- `id`
- `booth_id`
- `version`
- `render_path_social`
- `render_path_print`
- `rendered_at`

## 15. Technical architecture

### Client

- Next.js or equivalent React framework
- Mobile-first responsive interface
- Browser `MediaDevices.getUserMedia()` for camera capture
- Canvas API for local preview and composition
- Client-side image orientation correction and safe compression

### Backend

- Server routes or Node.js service for booth state and secure media operations
- Supabase Postgres for relational data
- Supabase Storage or equivalent object storage for confirmed frames
- Supabase Realtime or polling for waiting-room progress
- Row-level security or equivalent authorization rules

### Rendering

- Generate immediate previews in the browser.
- Generate canonical social and print artifacts on the server using Sharp or an equivalent renderer.
- Store the customization snapshot used for each artifact version.

### Authentication

- Participants use scoped invitation and claim tokens in MVP.
- Creator receives a private management token stored in the creation URL and browser storage.
- Account creation may be added later for persistent booth libraries.

## 16. Analytics

Analytics must not capture photographs, booth names, participant names, prompts, or invitation tokens.

### Core events

- `booth_creation_started`
- `booth_created`
- `invitation_link_copied`
- `invitation_opened`
- `slot_claimed`
- `camera_permission_requested`
- `camera_permission_denied`
- `capture_started`
- `frame_retaken`
- `frame_confirmed`
- `booth_completed`
- `booth_revealed`
- `artifact_downloaded`
- `booth_deleted`

### Product metrics

- Booth creation completion rate
- Invitation-to-slot-claim conversion
- Slot claim-to-frame-confirmation conversion
- Percentage of booths that reach completion
- Median time from booth creation to completion
- Median participant completion time
- Artifact download rate
- Percentage of completed booths downloaded by more than one participant
- Camera permission failure rate by browser and operating system
- Booth completion rate by participant count

### Initial targets

Targets should be treated as hypotheses until the first usability tests.

- At least 70% of invited participants who claim a slot confirm a frame.
- At least 60% of booths with two to four participants reach completion.
- Median participant task time is under two minutes.
- At least 70% of completed booths produce one artifact download.

## 17. Notifications

### MVP

- No mandatory account or push notification system.
- Creator can copy an invitation and a gentle reminder message.
- Participants can revisit the same link for status.

### P1

- Optional email notification when the strip is ready.
- Optional creator reminder after 48 hours if the booth remains incomplete.
- Maximum one automatic reminder per booth unless the creator explicitly requests another.

## 18. Content and tone

The product voice should feel warm, concise, and lightly playful. It should not sound sentimental before the user has created something meaningful.

Preferred language:

- “Make a photo together”
- “Your frame”
- “Two friends left”
- “The booth is ready”
- “Reveal the strip”

Avoid:

- “Content creation”
- “Engagement”
- “Complete your task”
- “You are holding everyone up”
- “Post now”
- “Maintain your streak”

## 19. Release plan

### Phase 0 — Design validation

- Create low-fidelity flows for two-, four-, and six-person booths.
- Design the final reveal before the creation flow.
- Build a clickable prototype of creation, capture, waiting, and reveal.
- Test with one real long-distance friend group.
- Validate whether named slots or open slots feel more natural.
- Validate whether participants prefer hidden frames or live previews.

### Phase 1 — Functional prototype

- Two- to four-person booths
- One classic vertical layout
- Booth name and participant labels
- One curated theme
- Camera capture and retake
- Private invitation links
- Waiting room
- PNG generation and download

### Phase 2 — MVP

- Two to six participants
- Three responsive layouts
- Theme presets and controlled customization
- Preset and custom prompts
- Countdown options
- Scheduled reveal
- Print-quality artifact
- Creator controls and deletion
- Camera fallback and supported-browser handling

### Phase 3 — Expansion

- Multiple rounds
- Synchronized reveal
- Captions and doodles
- Persistent accounts and booth library
- Physical prints
- Occasion-specific templates

## 20. Acceptance criteria for MVP launch

The MVP is ready for external use when:

- A creator can configure and open a booth on a supported mobile browser.
- The participant count correctly controls the number of required slots.
- Named and open slots behave correctly under concurrent access.
- Every participant can capture, review, and confirm exactly one frame.
- No confirmed frame is visible before the configured reveal.
- The booth completes only when all required frames are confirmed.
- The generated strip matches the chosen name, participant order, layout, theme, and labels.
- The social PNG downloads successfully on supported iOS, Android, and desktop browsers.
- Camera-denied users have a working file-upload fallback.
- Creator deletion removes access to the booth and begins media deletion.
- Accessibility checks pass for keyboard navigation, contrast, touch targets, and reduced motion.
- No final artifact exposes precise location metadata from uploaded images.

## 21. Open product decisions

- Should every participant see the prompt before accepting the invitation?
- Should completed frames remain completely hidden or appear as silhouettes?
- Should the creator be allowed to see frames before the group reveal?
- Should the participant limit remain six or expand to eight?
- Does each participant need a distinct claim link for named slots?
- Should the final strip be editable after reveal?
- What retention duration feels private without making the keepsake disappear unexpectedly?
- Should the product optimize initially for friendship, couples, or occasions?
- Should an unfinished booth allow a partial reveal after a deadline?

## 22. Recommended design decision defaults

For the first prototype:

- Optimize for close friend groups.
- Support two to four participants.
- Use named slots.
- Use a classic vertical strip.
- Give every participant one frame.
- Hide all photographs until completion.
- Allow the creator to participate but not preview other frames.
- Reveal immediately after the final frame is confirmed.
- Provide one warm neutral theme and one playful color theme.
- Use private invitation links with no participant accounts.
- Delete the booth automatically after 90 days unless retained.

These defaults preserve the central emotional moment while limiting technical and design complexity.
