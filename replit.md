# Timecapsule

Timecapsule is a private asynchronous photo booth where friends and family contribute one or more photos each, then reveal a shared keepsake together.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server with the artifact-managed port
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — manually reconcile a reviewed schema change with the development DB only; inspect the proposed SQL before accepting it
- PostgreSQL and private App Storage are managed by Replit in this workspace

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, mounted at `/api`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/timecapsule/src/pages/timecapsule.tsx` — landing, setup, invitation, capture, reveal, and archive flows
- `artifacts/timecapsule/src/components/timecapsule-ui.tsx` and `src/index.css` — shared UI and visual system
- `artifacts/timecapsule/public/sw.js` and `public/brand/timecapsule.webmanifest` — PWA shell and install metadata
- `artifacts/api-server/src/routes/booths.ts` — booth lifecycle and photo access gates
- `lib/api-spec/openapi.yaml` — source of truth for generated API types/hooks
- `lib/db/src/schema` — database schema

## Architecture decisions

- Anyone with a private link can view booth progress and revealed keepsakes. Sign-in is required to create or change booths and save photos; private creator and participant tokens provide additional scoped access.
- Photo objects stay in private App Storage; the API serves frames only after every required slot is submitted and any scheduled reveal time has passed.
- Creator and participant tokens are stored as hashes.
- The workspace uses Replit PostgreSQL and App Storage rather than a Supabase adapter.
- Booth data and media have no automatic expiry. Creators can delete a booth and its media explicitly.
- `booths.participant_count` currently stores the number of photo slots; API responses derive the number of people using `photos_per_person`. Preserve this legacy storage meaning unless a data migration is planned.
- `booths.expires_at` is nullable. The API startup migration may relax an older NOT NULL constraint but must never clear existing expiry values.
- The unused `push_subscriptions` table remains in the Drizzle schema to avoid an automatic production DROP TABLE proposal. No application code reads or writes it.

## Product

- Create a 1–6 person booth with a frame layout, prompt, countdown, and one or more photos per person. New booths reveal when everyone finishes.
- Signed-in invitees can claim a slot, capture or choose their photos, review them privately, and finalize their set.
- The booth tracks submissions without exposing frames early. The group can reveal and download the result.
- The private link lets people return to the booth to see the finished keepsake.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- OpenAPI paths omit `/api`; the API server mounts the router at `/api`, and the web client adds that base path at runtime.
- Regenerate the API client after changing the OpenAPI contract.
- Explicit booth deletion removes media before database rows; failed storage deletion leaves the booth for a later retry.
- Never expose raw object-storage URLs or cache private booth frames.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
