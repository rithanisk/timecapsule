---
name: Timecapsule API routing and slot claims
description: Generated-client path prefixes and creator-assigned names for invitee frame claims.
---

The Timecapsule browser uses generated API routes that already include `/api`. Do not prepend `/api` with `setBaseUrl` or another proxy. The shared Replit proxy preserves paths and the API service handles `/api` directly.

Invite slots are assigned names by the creator. A claim must send the selected slot's assigned display name; the API rejects a different typed name.

**Why:** Prepending `/api` caused the browser to post to `/api/api/booths`. A free-form invite name that differed from the selected frame also caused a 403.

**How to apply:** When changing API base paths or invite claims, verify the browser sends `/api/booths` exactly once and the claim body matches the selected frame name. Exercise the web client, not only raw API calls.
