# Guest access — manual E2E checklist

Environment: set `VITE_API_BASE_URL` (see `src/services/api/client.ts`).

Optional overrides:

- `VITE_ANONYMOUS_ACCESS_PERMISSION_PATH` — default `/api/access/permission`
- `VITE_ACCESS_SESSION_URL_TEMPLATE` — default `/api/access/session/{guest_id}`
- `VITE_GUEST_QR_TOKENS_BASE_PATH` — default `/api/access/qr-tokens`

## Administrator — guest QR tokens (`/guest-access-qr`)

Requires **administrator** role (nav shows **Guest QR** only for admins).

1. **Issue new QR** tab: `POST /api/access/qr-tokens` with `zone_id`, optional `expires_in_hours` / `expires_at` (mutually exclusive), `event_id`, `label`, `max_uses`. Expect **201** and one-time display of `token`, `url`, client-rendered QR.
2. **Active tokens** tab: `GET /api/access/qr-tokens?zone_id=…&include_revoked=&limit=`.
3. **Link** on a row: `GET /api/access/qr-tokens/{id}/link?zone_id=…` then copy URL.
4. **PNG**: `GET /api/access/qr-tokens/{id}/qr.png?zone_id=…` with Bearer (browser download via authenticated `fetch`/blob).
5. **Revoke**: `POST /api/access/qr-tokens/{id}/revoke?zone_id=…`.

Dashboard **Guest access QR** block links to this page (no inline issuance).

## Public guest flow (`/access`)

6. **Token link**: `/access?gt=<opaque>` — submit check-in: `POST /api/access/permission` with `guest_qr_token`, `guest_name`, optional `event_id`, `device_id`, `location`; optional `zone_id` only if also in URL and must match token zone.
7. **Legacy plain zone**: `/access?zid=…` still sends `zone_id` + `guest_name` (no `gt`).
8. **EXPECTED** / **UNEXPECTED** + `guest_id` polling: `GET /api/access/session/{guest_id}` with `zone_id` query **when** `zid` is present; otherwise poll **without** `zone_id` (if your API allows). Client polls until **APPROVED** / **REJECTED** (no time limit); waiting state is restored after refresh via `sessionStorage` until then.
9. Error codes: `INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_DEPLETED`, `ZONE_MISMATCH`, `EVENT_MISMATCH` — UI should show `error_code` and `message` from the global JSON error shape when returned.

## Deep linking / hosting

10. Hard-refresh `/access?gt=…` and `/guest-access-qr`; SPA host must rewrite unknown paths to `index.html` (e.g. `public/_redirects` on Netlify).

## Security UX

11. `/access` must not send Bearer JWT on permission/poll calls (unauthenticated `guestAxios` only for those).

## Regression

12. `/qr` remains **account invite** (`POST /utils/qr/generate`), not guest door access.
