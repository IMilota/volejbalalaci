# Volejbalaláci — Frontend (REST client, magic link, PWA)

Date: 2026-09-01

Depends on: `docs/superpowers/specs/2026-08-29-rest-endpoints-design.md` (HTTP paths, error codes, occupancy, Web Push payloads). This spec does not repeat field tables.

## Goal

Replace the broken CRA client (file-DAO URLs, impersonation dropdown, `userMap` / `date`) with a Bootstrap app on `/api`, magic-link session, event-first navigation, board + per-event messages, admin members, and explicit PWA install / Web Push.

## Out of scope

- Rides / `FEATURE_RIDES` UI (config may still be fetched; do not show ride screens or nav)
- Waitlist, user delete, member-priority occupancy
- New UI stack (Vite, UU5, Tailwind). Stay CRA + `react-bootstrap` + MDI
- Auto-prompt for install or notifications
- Offline-first API cache; Playwright / e2e
- Theme driven by `instanceColorScheme` env (ball palette is fixed this wave)
- Email as a notification channel

## Architecture

Keep `client/` CRA (`proxy`: `http://localhost:3111`). One app: delete the leftover Celoškovi shell (`App.js` dual navbar, root `user-provider.js` `/login` nickname POST).

| Unit | Responsibility |
|---|---|
| `api` helper | `fetch`, JSON, `Authorization: Bearer <sessionToken>`. Non-OK JSON `{ code, message }` throws `ApiError` with those fields |
| `AuthProvider` | token in `localStorage`, `GET /api/me` on boot, login consume, logout / logout-all, 401 → clear token → `/login` |
| `ConfigProvider` | `GET /api/config` once (`vapidPublicKey`, `instanceName`; ignore rides UI) |
| `UsersCache` | `GET /api/users` for display names on RSVP and messages |
| Route screens | `/login`, `/`, `/events`, `/events/:id`, `/board`, `/users` |

Session secret (not the magic-link challenge) is the only token stored. Key: `sessionToken`.

## Routes and shell

Public: `/login`. Query `token` → `POST /api/auth/consume` `{ token }`, store `body.token`, redirect to `/`. Missing/invalid token on consume → stay on login with error. Email form: `POST /api/auth/challenge` `{ email }`; always show the same success copy (no user enumeration). Other paths without a session → redirect to `/login`.

Authenticated nav: **Nástěnka** (`/board`) · **Termíny** (`/events`). **Členové** (`/users`) only if `role === "admin"`. Account menu: display name, **Odhlásit** (`POST /api/auth/logout`), **Odhlásit všude** (`POST /api/auth/logout-all`), install and notifications when eligible (see PWA).

`/` after login:

1. `GET /api/events` (default `startAt >= now`).
2. Filter `status === "scheduled"`, sort by `startAt` ascending, take first.
3. If found → redirect to `/events/:id`.
4. If none → empty state on `/` (“zatím žádný termín”). Admin sees create (and bulk) actions.

Cancelled events are never “nearest”. They appear on `/events` with a badge.

Document title: `instanceName` from config if set, else `Volejbalaláci`. Favicon: `instanceIcon` when it is a non-empty URL; otherwise keep the existing volejbalalaci ico.

## Events and RSVP

**List `/events`:** cards with name, start/end, location, `occupied / capacity`, cancelled badge. Click → `/events/:id`. Admin: **Nová událost**, **Nové události**.

**Detail `/events/:id`:** `GET /api/events/:id` and `GET /api/events/:id/attendances`. Occupancy from `occupied`, not recounted in the client. List attendees with status, guests, note. Cancelled: RSVP controls disabled; **messages stay enabled**.

**RSVP:** `PUT /api/events/:eventId/attendances/me` `{ status, guests?, note? }`. Status `yes` / `no` / `maybe`. Guests 0–6 only when `yes`; otherwise send/show 0. Note max 280. On `capacityExceeded` or `eventCancelled`, show the mapped Czech error and keep the last successful attendance (do not optimistic-lock a failing yes). Admin may `PUT .../attendances/:userId` for someone else.

**Create / edit:** `name`, `startAt`, `endAt` (end after start), `location`, `capacity` ≥ 1, optional `description`. Create `POST /api/events`. Edit `PATCH` (never send `status` or `reminderSentAt`). Cancel `POST /api/events/:id/cancel` (not DELETE). Replace the unlabeled “U” control with labeled admin **Upravit** / **Zrušit**.

**Bulk:** shared header fields plus `occurrences: [{ startAt, endAt }]` (length ≥ 1). `POST /api/events/bulk`. Success → `/events`.

## Messages

One thread UI, two mounts:

- `/board` — `GET /api/messages` (no `eventId` → board)
- Event detail — `GET /api/messages?eventId=`

Server returns a flat list sorted by `createdAt`. Client groups replies by `replyToId`. Reply control only on roots (one level).

Post: board `{ body }`; event `{ body, eventId }`; reply adds `replyToId`. Body max 2000. Patch `{ body }` and delete: author or admin. Root delete uses server `deleteWithReplies`. Resolve author labels via users list; fallback to shortened `userId`.

Backend sends Web Push after POST; the client does not duplicate that.

## Members

`/users` is admin-only. Non-admin route → permission message, not the table. Nav item **Členové** hidden for `role === "user"`.

Table: name, nickname, email, role. No delete.

Create: `POST /api/users` `{ name, nickname, email, role? }` default `user`. The new member signs in later with magic link to that email. No passwords.

Patch: same fields. Show 409 `emailAlreadyExists`, `nicknameAlreadyExists`, `lastAdmin` on the form. UI may disable demoting the last remaining admin; the API is authoritative.

`GET /api/users` remains available to any logged-in user for name resolution elsewhere.

## PWA

**Install:** listen for `beforeinstallprompt`, `preventDefault`, keep the event. Account menu **Nainstalovat** only if that event exists and the app is not `display-mode: standalone`. After `prompt()`, drop the event. No automatic modal.

**Push:** hide both actions when `vapidPublicKey` is null. **Zapnout oznámení** when there is no PushSubscription for this origin. User gesture → `Notification.requestPermission` → `pushManager.subscribe` → `POST /api/push/subscribe` with the PushSubscription JSON. On 503 `pushNotConfigured`, hide the actions. **Vypnout oznámení** when a subscription exists → `DELETE /api/push/subscribe` `{ endpoint }` then `unsubscribe()`.

**Service worker:** show notifications on push. Notification click:

- `type === "message"` and `eventId` null → `/board`
- `type === "message"` with `eventId` → `/events/:id`
- `type === "reminder"` → `/events/:id`

## Visual

Gala-ball proportions, not both brand colors as large surfaces:

- Page background **white** (not a full-viewport blue)
- Navbar **blue**, white text, volleyball icon
- Primary buttons (login, save, RSVP yes) **blue**
- **Red only** for destructive / alarm: cancel event, logout, capacity full, delete message
- Body text **near-black**
- Do not use Bootstrap green “success” for attendance (breaks the palette): yes = blue, no = red/outline, maybe = neutral
- One navbar; no purple leftover; no full-width red footer band
- Czech **sentence case** on labels

## Errors, loading, tests

Map API `code` to a Czech string in one table in the client. Forms: inline Bootstrap `Alert`. List/detail load failures: Alert in the content area (not only `console.log`). 401 → clear session → `/login`. `/users` 403 → permission copy. Network failure → connection copy.

First paint of a screen: spinner in the body. Submit buttons disabled + spinner; no double POST.

Tests: `react-scripts test`, mock `fetch`. Required cases:

- consume stores session token and leaves `/login`
- `/` redirects to the nearest scheduled event when one exists
- non-admin does not see **Členové**
- RSVP 409 does not replace local attendance with the failed payload
- without `vapidPublicKey`, **Zapnout oznámení** is absent

## Implementation order (after this spec)

1. `api` + auth + `/login` + config; strip old providers.
2. Event list/detail, nearest `/` redirect, RSVP, create/edit/cancel/bulk.
3. Board + event messages.
4. Members admin.
5. PWA install + push + service worker; ball palette shell.

## Decisions rejected

- Patching old `EventListProvider` field names (`date`, `userMap`) instead of speaking REST
- Dropdown impersonation login
- Default route = event list
- Auto install / notification prompts
- Red navbar + blue page fill (too much ball)
- Rides and user-delete in this wave
