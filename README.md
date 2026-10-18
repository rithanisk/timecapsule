# Timecapsule

Timecapsule is a private, asynchronous photo booth for 2–6 people. Each person claims a place from an invite link and confirms one or more photos. Frames stay hidden until everyone has submitted; then the group can reveal, edit, and download the keepsake.

When a booth asks for multiple photos per person, each confirmed shot is saved to that participant's private camera roll. They can review, delete, or retake saved shots before finalizing the whole set. The group reveal only counts that person's photos after they finalize.

## Workspace

- `artifacts/timecapsule` — mobile-first React/Vite web app at `/`
- `artifacts/api-server` — Express API mounted at `/api`
- `lib/api-spec/openapi.yaml` — API source of truth
- `lib/db/src/schema` — PostgreSQL schema
- `artifacts/timecapsule/public/sw.js` — offline app shell and push notification handling

The configured `artifacts/timecapsule: web` and `artifacts/api-server: API Server` workflows provide the ports and base paths. The app uses Replit PostgreSQL and private App Storage; Supabase is not required.

## Development

Use the configured web and API workflows in Replit. For a schema update, run:

```sh
pnpm --filter @workspace/db run push
```

After changing `lib/api-spec/openapi.yaml`, regenerate the client and validators:

```sh
pnpm --filter @workspace/api-spec run codegen
```

## Privacy and retention

- Sign-in is required to create a booth, claim a frame, save photos, change a keepsake, delete a booth, or save a notification subscription. The API rejects unsigned booth writes. Private links still let guests view booth progress and revealed keepsakes. The signed-out home page always shows the same sample collage; signed-in accounts show their own booths and home page photostrip choices. Creator and participant token hashes remain in the database.
- Photo files are stored in private App Storage; PostgreSQL stores booth, slot, ownership, customization, and home selection records with paths to those files.
- App Storage objects remain private. A frame is uploaded only after the participant confirms it; the API validates and normalizes it to JPEG, rotating pixels according to camera orientation and stripping embedded metadata.
- Photo routes check the booth reveal gate and disable caching. API logs redact booth tokens.
- Booth photos and database records have no automatic expiry. The creator can explicitly delete a booth and its media using the private creator link.
- Share private invite links only with the intended participants. Anyone who receives a booth link can see its progress, but no frame is returned before the reveal gate opens.

## Optional push notifications

Push is opt-in only after a user gesture. Without VAPID configuration, the app keeps the private-link fallback and does not save a push subscription.

To enable push, configure these as Replit environment variables/secrets:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — public key read by the API
- `VITE_VAPID_PUBLIC_KEY` — the same public key exposed to the Vite client
- `VAPID_PRIVATE_KEY` — private VAPID key; keep it in Replit Secrets
- `VAPID_SUBJECT` — a valid `mailto:` or HTTPS contact URI

Subscription endpoints and keys are encrypted at rest using `SESSION_SECRET`. A successful ready notification is sent once; expired subscriptions are removed.

See [`.env.example`](.env.example) for optional integrations. The Supabase variables there are placeholders only and are not used by the Replit-native implementation.
