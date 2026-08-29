# Volejbalaláci — domain model and MongoDB storage

Date: 2026-08-28

## Goal

Replace file JSON storage with MongoDB. The existing Express/React app is a **reference only**, not a schema to copy. Build the domain from the entities below, then rewrite backend endpoints to match, then the frontend.

This spec covers **entities, collections, rules, auth tokens, and instance config**. It does not specify HTTP paths, request bodies, or UI. Those are later specs.

## Out of scope (later)

- Endpoint shapes and ABL rewrite
- Frontend (login UX, event list, rides, theme)
- Regular-member priority on capacity
- User deactivation / deletion
- Waitlist
- `eventSeries` parent documents
- Theme/icon/color polish (env keys exist so FE can read them)

## Architecture

- Database: MongoDB, native install (not Docker). Connection from env so Atlas can replace local later.
- ODM: Mongoose.
- Collections (not embedded graphs): `users`, `events`, `attendances`, `messages`, `rides`, `loginChallenges`, `sessions`.
- API `id` is the string form of `_id`. Timestamps UTC ISO. Every document has `createdAt` / `updatedAt` (Mongoose timestamps).
- Empty database on first run, except **seed of the first admin** when `users` is empty.
- Old `server/dao/.../storage` JSON files are not migrated and are not the source of truth.

## Collection: `users`

| Field | Type | Rules |
|---|---|---|
| `name` | string | required |
| `nickname` | string | required, unique, trimmed |
| `email` | string | required, unique, stored lowercase |
| `role` | `"admin"` \| `"user"` | default `"user"` |

No password. No `active` flag in this version (deletion/deactivation later).

Users are created only by an admin. The first admin is seeded when `users` is empty, from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_NICKNAME`.

## Collection: `events`

One document per occurrence. Bulk create is an **operation**: same `name` / `location` / `capacity` / optional `description`, many `{ startAt, endAt }` rows → many inserts. No `eventSeries` entity.

| Field | Type | Rules |
|---|---|---|
| `name` | string | required |
| `startAt` | Date | required |
| `endAt` | Date | required, after `startAt` |
| `location` | string | required, free text (no `venue` entity) |
| `capacity` | number | required, integer ≥ 1 |
| `description` | string | optional |
| `status` | `"scheduled"` \| `"cancelled"` | default `"scheduled"` |

Create / update / cancel: **admin only**. Cancel sets `status: "cancelled"`; do not physically delete (attendances, messages, rides stay).

Capacity is **not** stored as a running counter. Occupancy is computed from `attendances` at write time.

## Collection: `attendances`

One document per user per event. Unique index `(eventId, userId)`.

| Field | Type | Rules |
|---|---|---|
| `eventId` | ObjectId | required |
| `userId` | ObjectId | required |
| `status` | `"yes"` \| `"no"` \| `"maybe"` | required |
| `guests` | number | 0–6, default 0 |
| `note` | string | optional, max 280 characters |

Occupancy: for each `status: "yes"` count `1 + guests`. `maybe` and `no` do not take a slot. If a `yes` write would exceed `event.capacity`, reject. No waitlist. No regular-member priority.

Write rules:

- User may change only their own attendance.
- Admin may change anyone’s.
- No attendance writes when the event is `cancelled`.
- If `status` is `no` or `maybe`, persist `guests` as `0`.

## Collection: `messages`

One collection for event threads and the app-wide board. Board = `eventId: null`. Flat replies: one level, no tree.

| Field | Type | Rules |
|---|---|---|
| `eventId` | ObjectId or `null` | `null` = app board (always stored, never omitted — so queries can use `eventId: null`) |
| `authorId` | ObjectId | required |
| `body` | string | required, 1–2000 characters |
| `replyToId` | ObjectId or omitted | omitted = root post; set = reply to a **root** message |

- Reply must share the same board/event as the parent.
- `replyToId` must point at a message with no `replyToId`. Reply-to-reply is rejected.
- Any logged-in user may post. Author or admin may update/delete.
- Deleting a root deletes its replies. Deleting a reply leaves the root.

Index: `{ eventId: 1, createdAt: 1 }`. Board queries use `eventId: null`.

## Collection: `rides`

Used only when `FEATURE_RIDES=true`. Otherwise ride APIs refuse the request. Unique index `(eventId, driverId)`: one offer per driver per event.

| Field | Type | Rules |
|---|---|---|
| `eventId` | ObjectId | required |
| `driverId` | ObjectId | required (creator) |
| `from` | string | required |
| `to` | string | required |
| `seats` | number | required, integer ≥ 1, passenger seats (driver not included) |
| `departAt` | Date | required |
| `note` | string | optional (meeting point, etc.) |
| `passengerIds` | `[ObjectId]` | default `[]`, no duplicates, must not include `driverId` |

- Join rejected when `passengerIds.length >= seats`.
- Logged-in user may create/update/cancel **their** ride; admin may any.
- Logged-in user may join/leave if not the driver and seats remain.
- No writes when the event is `cancelled`.
- Event attendance `yes` is **not** required to offer or join a ride.

## Auth: `loginChallenges` and `sessions`

No passwords. Admin creates the user first. The person opens the app, submits **email**. If that email exists, send a mail with the app URL and a one-time code. Unknown emails get the **same** generic success response (no user enumeration).

### `loginChallenges`

| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId | required |
| `tokenHash` | string | SHA-256 of the email code |
| `expiresAt` | Date | now + 30 minutes |
| `consumedAt` | Date or omitted | set on successful consume |

Email code: long random secret, stored hashed, valid **once**, 30 minutes. After consume, the server issues a **different** session token. The email code never becomes the session. A new challenge does not invalidate other unused challenges (they expire on `expiresAt`).

Local development: if SMTP is not configured, log the magic URL to the server console instead of sending mail. Production requires SMTP.

### `sessions`

| Field | Type | Rules |
|---|---|---|
| `userId` | ObjectId | required |
| `tokenHash` | string | SHA-256 of the bearer token |
| `createdAt` | Date | |
| `lastUsedAt` | Date | |

Multiple sessions per user (phone + browser). Logout deletes **this** session. Logout-everywhere deletes all of that user’s sessions. Sessions do not expire until logout.

Authenticated requests: `Authorization: Bearer <token>`. Invalid or consumed challenge → 401.

TTL index on `loginChallenges.expiresAt` for cleanup.

## Permissions

Unauthenticated: public instance config, request login challenge, consume challenge. Nothing else.

| Action | `user` | `admin` |
|---|---|---|
| Read events, attendances, messages, rides | yes | yes |
| Own attendance (status, guests, note) | yes | yes |
| Someone else’s attendance | no | yes |
| Post message | yes | yes |
| Edit/delete message | own | all |
| Ride offer / join / leave | yes, if `FEATURE_RIDES` | yes, if `FEATURE_RIDES` |
| Edit/cancel ride | own | all |
| Event create (including bulk) / update / cancel | no | yes |
| Create user, change `role` | no | yes |

## Instance configuration (env)

Not stored in Mongo.

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | connection string (local now, Atlas later) |
| `MONGODB_DB` | database name, default `volejbalalaci` |
| `FEATURE_RIDES` | `true` / `false` |
| `SEED_ADMIN_EMAIL` | first admin email |
| `SEED_ADMIN_NAME` | first admin name |
| `SEED_ADMIN_NICKNAME` | first admin nickname |
| `APP_BASE_URL` | origin used in the magic-link URL |
| SMTP vars | defined when implementing mail send |

Frontend later (same env pattern, exposed via public config): instance name, icon, color scheme.

## Amendment (2026-08-29)

From the REST spec: collection `pushSubscriptions` (`userId`, unique `endpoint`, `p256dh`, `auth`). Event field `reminderSentAt` (Date, omitted until the 24 h attendance reminder is sent). Web Push only (not email notifications). Details: `docs/superpowers/specs/2026-08-29-rest-endpoints-design.md`.

## Implementation order (after this spec)

1. Install local MongoDB, wire Mongoose, models, indexes, admin seed.
2. Rewrite backend endpoints against this model (auth, CRUD, capacity, rides flag, Web Push).
3. Frontend, including theme and PWA install.

## Decisions rejected

- Copying current DAO/file schema 1:1
- `athlete` as the person entity
- `venue` collection
- Embedding attendance/rides in the event document
- `eventSeries`
- Password login
- Using the email code as the long-lived session
- Waitlist or over-capacity writes
- Import of existing June 2025 JSON events
- Docker Mongo for this project
