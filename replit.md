# Timecapsule

Timecapsule is a private asynchronous photo booth where friends and family contribute one frame each, then reveal and edit a shared keepsake together.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server with the artifact-managed port
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- PostgreSQL and private App Storage are managed by Replit in this workspace
- Optional push requires VAPID environment variables; see `README.md`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, mounted at `/api`
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (ESM bundle)

## Where things live

- `artifacts/timecapsule/src/pages/timecapsule.tsx` — landing, setup, invitation, capture, reveal, editor, and notification flows
- `artifacts/timecapsule/src/components/timecapsule-ui.tsx` and `src/index.css` — shared UI and visual system
- `artifacts/timecapsule/public/sw.js` and `public/brand/timecapsule.webmanifest` — PWA shell and install metadata
- `artifacts/api-server/src/routes/booths.ts` — booth lifecycle and photo access gates
- `artifacts/api-server/src/lib/retention.ts` and `pushNotifications.ts` — retention and optional push delivery
- `lib/api-spec/openapi.yaml` — source of truth for generated API types/hooks
- `lib/db/src/schema` — database schema

## Architecture decisions

- Invitees do not create accounts; private booth and participant tokens provide narrowly scoped access.
- Photo objects stay in private App Storage; the API serves frames only after every required slot is submitted and any scheduled reveal time has passed.
- Creator and participant tokens are stored as hashes. Push subscription payloads are encrypted with a key derived from `SESSION_SECRET`.
- The workspace uses Replit PostgreSQL and App Storage rather than a Supabase adapter.
- Booth data and media are retained for up to 90 days and then purged by the API cleanup job.

## Product

- Create a 2–6 person booth with one of six layouts, Classic or Scrapbook styling, a prompt, countdown, and optional scheduled reveal.
- Invitees can claim a slot without an account, capture or choose a photo, review it privately, and confirm before upload.
- The booth tracks submissions without exposing frames early. The group can reveal, edit the layout/frame/filter/stickers/text, and download the result.
- Optional Web Push is requested only through an explicit action and has a private-link fallback.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- OpenAPI paths omit `/api`; the API server mounts the router at `/api`, and the web client adds that base path at runtime.
- Regenerate the API client after changing the OpenAPI contract.
- Retention deletes media before database rows; failed storage deletion leaves the booth for a later cleanup retry.
- Never expose raw object-storage URLs or cache private booth frames.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
