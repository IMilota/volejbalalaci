# Volejbalaláci — REST endpoints

Date: 2026-08-29

Depends on: `docs/superpowers/specs/2026-08-28-mongodb-domain-model-design.md` (entities, occupancy, auth tokens, permissions). This spec does not repeat field tables.

## Goal

Replace file-DAO HTTP (`/api/volejbalalaci/...`) with REST under `/api` on Mongoose models. Frontend is **out of scope** — the old client will break; that is intended.

## Out of scope

- React / login UI / theme polish / PWA install button (`beforeinstallprompt`, standalone detection)
- Waitlist, user delete, regular-member priority
- OpenAPI generator, Nest, keeping ABL folders
- Real SMTP as a hard requirement (env optional)
- Email as a notification channel (magic-link mail only)
- Ride-join or cancel-event push (later)

## Architecture

Express routers + auth middleware + small services (`mail`, `push`, occupancy already on `Attendance`). New model `PushSubscription`; `Event.reminderSentAt` (Date, omitted until a reminder is sent). `app` is exported for `supertest`; `listen` only when `require.main === module` (already true). In-process `node-cron` (every 15 minutes) for attendance reminders. Web Push via `web-push` + VAPID.

Delete: `server/controller/`, `server/abl/`, `server/dao/`, and unused `server/helpers/validate-date-time.js`. Ajv is not required on new routes; invalid bodies → 400 with `code`/`message`. Mongoose `ValidationError` → 400; unique conflicts → 409.

## Conventions

- Base path: `/api`
- JSON request/response. Document `id` is `String(_id)` (`toJSON`).
- Timestamps ISO UTC.
- Errors: `{ "code": "eventNotFound", "message": "..." }`
- HTTP: 400 validation, 401 missing/invalid session or consume failure, 403 authenticated but not allowed, 404 missing resource or rides disabled, 409 conflict (capacity, unique, cancelled event, last admin).
- Authenticated requests: `Authorization: Bearer <sessionToken>`. Middleware hashes with `hashToken`, loads `Session` + `User`, sets `req.user`, updates `lastUsedAt`.
- `requireAuth` on everything except `GET /api/config`, `POST /api/auth/challenge`, `POST /api/auth/consume`.
- `requireAdmin` on user create/patch, event create/bulk/patch/cancel, attendance for another user.

## Auth and config

| Method | Path | Auth | Body / notes |
|---|---|---|---|
| `GET` | `/api/config` | no | `{ featureRides, vapidPublicKey }` (`vapidPublicKey` is `null` if VAPID env is missing) plus optional theme keys from env (`instanceName`, `instanceIcon`, `instanceColorScheme`) — FE may ignore until later |
| `POST` | `/api/auth/challenge` | no | `{ email }` — always **200** with a generic body (e.g. `{ ok: true }`). If the email exists, create `loginChallenge` (30 min, one-time, hashed). Unknown email: same 200, no challenge. No user enumeration |
| `POST` | `/api/auth/consume` | no | `{ token }` — plaintext from the mail. Invalid/expired/consumed → 401. Success: mark `consumedAt`, create `Session`, return `{ token, user }` where `token` is the **session** secret (not the email code) |
| `POST` | `/api/auth/logout` | yes | delete this session |
| `POST` | `/api/auth/logout-all` | yes | delete all sessions for `req.user` |
| `GET` | `/api/me` | yes | current `user` JSON |

Magic link URL: `{APP_BASE_URL}/login?token={plaintextChallenge}`.

Mail: `server/services/mail.js`. If `SMTP_HOST` and `SMTP_FROM` are set, send (nodemailer). Otherwise `console.log` the URL. `SMTP_FROM` is **not** the admin login mailbox (`celotka@gmail.com` stays the user email). Optional: `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`. Tests must not send real mail — stub or assert the log path.

## Users

| Method | Path | Who | Body |
|---|---|---|---|
| `GET` | `/api/users` | any logged-in | list of users (no hashes) |
| `POST` | `/api/users` | admin | `{ name, nickname, email, role? }` default `role: "user"` |
| `PATCH` | `/api/users/:id` | admin | any of `name`, `nickname`, `email`, `role` |

No `DELETE`. Duplicate nickname/email → 409. Demoting or changing the last remaining `admin` so zero admins would remain → 409 `lastAdmin`.

## Events

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/api/events` | logged-in | Optional query `from`, `to` (ISO). Default: `startAt >= now`. Include `scheduled` and `cancelled`. Each item: event JSON + `occupied` (`Attendance.occupiedSeats`) |
| `GET` | `/api/events/:id` | logged-in | event + `occupied`. **No** embedded attendance list |
| `POST` | `/api/events` | admin | `{ name, startAt, endAt, location, capacity, description? }` |
| `POST` | `/api/events/bulk` | admin | `{ name, location, capacity, description?, occurrences: [{ startAt, endAt }] }` — insert N events; empty `occurrences` → 400 |
| `PATCH` | `/api/events/:id` | admin | subset of event fields (not `status` here) |
| `POST` | `/api/events/:id/cancel` | admin | set `status: "cancelled"` |

Physical delete is not an endpoint. `reminderSentAt` is server-only (not settable via PATCH).

## Attendances

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/api/events/:eventId/attendances` | logged-in | all attendances for that event |
| `PUT` | `/api/events/:eventId/attendances/me` | owner | `{ status, guests?, note? }` — `status` `yes`/`no`/`maybe`. Guests forced 0 unless `yes`. Capacity: `wouldExceedCapacity(..., { excludeId: existing })` → 409 `capacityExceeded`. Event `cancelled` → 409 `eventCancelled` |
| `PUT` | `/api/events/:eventId/attendances/:userId` | admin | same body and rules for that user |

Upsert: create if missing, replace fields if present.

## Messages

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/api/messages` | logged-in | No `eventId` query → board (`eventId: null`). `?eventId=` → that event. Flat list sorted by `createdAt` (client groups replies via `replyToId`) |
| `POST` | `/api/messages` | logged-in | `{ body, eventId?, replyToId? }` — omit `eventId` for board. Reply rules from the domain spec / Message `pre("validate")`. After save, Web Push to all subscriptions **except the author’s** |
| `PATCH` | `/api/messages/:id` | author or admin | `{ body }` |
| `DELETE` | `/api/messages/:id` | author or admin | use `deleteWithReplies` |

## Rides

If `FEATURE_RIDES` is not `true`, **all** ride routes below return 404 `ridesDisabled`.

| Method | Path | Who | Notes |
|---|---|---|---|
| `GET` | `/api/events/:eventId/rides` | logged-in | |
| `POST` | `/api/events/:eventId/rides` | logged-in | `{ from, to, seats, departAt, note? }` — unique `(eventId, driverId)` → 409. Cancelled event → 409 |
| `PATCH` | `/api/rides/:id` | driver or admin | `from`, `to`, `seats`, `departAt`, `note` (not `passengerIds` here) |
| `DELETE` | `/api/rides/:id` | driver or admin | |
| `POST` | `/api/rides/:id/join` | logged-in | not the driver; full → 409 `rideFull`; cancelled event → 409 |
| `POST` | `/api/rides/:id/leave` | logged-in | remove self from `passengerIds` |

Attendance `yes` is not required to offer or join.

## Web Push

PWA install UI is frontend-later. Backend stores subscriptions and sends pushes.

### Collection `pushSubscriptions`

| Field | Rules |
|---|---|
| `userId` | required, ObjectId |
| `endpoint` | required, unique |
| `p256dh` | required |
| `auth` | required |

Several rows per user (one per device). Timestamps + `id` like other models.

Env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (e.g. `mailto:provoz@example.com` — not the admin login mailbox).

| Method | Path | Who | Notes |
|---|---|---|---|
| `POST` | `/api/push/subscribe` | logged-in | Browser `PushSubscription` JSON. Upsert by `endpoint` (re-bind `userId` if the same endpoint logs in as another user). If VAPID missing → 503 `pushNotConfigured` |
| `DELETE` | `/api/push/subscribe` | logged-in | `{ endpoint }` — only that user’s row |

**Sends**

- After successful `POST /api/messages`: every subscription whose `userId` ≠ author. Payload JSON: `{ type: "message", messageId, eventId, title, body }` (`eventId` null on the board).
- Cron every **15 minutes** (started with `listen`, not when tests `require` the app): `scheduled` events with `reminderSentAt` missing and `startAt` in **(now+23h, now+25h]** (24 h ± 1 h window). Recipients: all users with at least one subscription whose attendance for that event is not `yes` and not `no` (`maybe` or no row). Then set `event.reminderSentAt = now`. One reminder per event.

Vendor **410** / **404** on send → delete that `pushSubscription`. Missing VAPID: cron no-ops; subscribe returns 503.

Library: `web-push`. Tests mock it; no real FCM/Mozilla.

## Error codes (normative)

`dtoInIsNotValid`, `unauthorized`, `forbidden`, `userNotFound`, `eventNotFound`, `attendanceNotFound`, `messageNotFound`, `rideNotFound`, `emailAlreadyExists`, `nicknameAlreadyExists`, `lastAdmin`, `capacityExceeded`, `eventCancelled`, `ridesDisabled`, `rideFull`, `rideAlreadyOffered`, `pushNotConfigured`.

## Tests

`supertest` against exported `app`. Database `volejbalalaci_test`. `--test-concurrency=1`. Cover: challenge does not leak whether email exists; consume issues a different session token; user cannot PUT others’ attendance; admin can; capacity 409; rides 404 when flag off; cancel blocks attendance/ride writes; message push skips author; reminder job respects `yes`/`no` and `reminderSentAt`; subscribe 503 without VAPID.

## Implementation order (after this spec)

1. Scaffold REST app (middleware, error handler, delete old API), config + auth + mail.
2. Users + events (`reminderSentAt`) + attendances.
3. Messages + rides.
4. Push subscriptions + send on message + reminder cron.
5. (Later, separate spec) frontend including PWA install button.
