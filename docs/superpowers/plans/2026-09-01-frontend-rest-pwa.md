# Frontend REST + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CRA client with REST + magic-link auth, event-first routes, board/messages, member admin, ball palette, and explicit PWA install/push.

**Architecture:** Keep CRA + Bootstrap + proxy `:3111`. One `api()` helper throwing `ApiError`. Providers: `AuthProvider`, `ConfigProvider`, `UsersProvider`. Screens under `client/src/screens/`. Delete Celoškovi shell and `api/volejbalalaci` fetches.

**Tech Stack:** React 18, react-router-dom 6, react-bootstrap 2, MDI, CRA `react-scripts test` (Testing Library). No Vite/UU5. No new npm packages unless a task cannot work without one (`npx uu-safe-install` from `client/` only).

**Spec:** `docs/superpowers/specs/2026-09-01-frontend-rest-pwa-design.md`

## Global Constraints

- Never `npm install` / `npm ci` / `npm update`; use `npx uu-safe-install` from `client/` if a package is required.
- Do not git-add `package-lock.json`, `node_modules`, `.env`.
- Session token key: `sessionToken` (session secret, not magic-link challenge).
- `Authorization: Bearer <sessionToken>` on authenticated `api()` calls.
- Errors: `{ code, message }` → `ApiError`; Czech copy from one map in `client/src/api/error-copy.js`.
- No rides UI even if `featureRides` is true.
- No auto `beforeinstallprompt` modal; no auto notification permission.
- Palette: white page, blue navbar/primary, red only destructive; no Bootstrap green for RSVP.
- Czech sentence case. Tests: `cd client && CI=true npx react-scripts test --watchAll=false`.
- `src/setupTests.js` must exist (CRA default). Move/copy from `src/volejbalalaci/setupTests.js` in Task 1.

## File map

| File | Responsibility |
|---|---|
| `client/src/api/client.js` | `api(path, { method, body, token })`, `ApiError` |
| `client/src/api/error-copy.js` | `errorCopy(code)` Czech strings |
| `client/src/auth/AuthProvider.js` | token, user, login consume, logout, logout-all, 401 |
| `client/src/config/ConfigProvider.js` | `GET /api/config` |
| `client/src/users/UsersProvider.js` | `GET /api/users`, `displayName(userId)` |
| `client/src/theme.css` | ball CSS variables + navbar |
| `client/src/shell/AppShell.js` | nav: Nástěnka, Termíny, Členové (admin), account menu |
| `client/src/screens/*.js` | Login, Home, EventList, EventDetail, Board, Users |
| `client/src/events/pickNearestScheduled.js` | pure helper for `/` redirect |
| `client/src/messages/MessageThread.js` | board + event thread |
| `client/src/pwa/useInstallPrompt.js` | `beforeinstallprompt` |
| `client/src/pwa/usePushSubscription.js` | subscribe/unsubscribe |
| `client/public/sw.js` | push display + notification click paths |
| `client/src/index.js` | providers, routes, SW register |

---

### Task 1: API helper, auth, login, config, strip old shell

**Files:**
- Create: `client/src/setupTests.js`, `client/src/api/client.js`, `client/src/api/error-copy.js`, `client/src/api/client.test.js`, `client/src/auth/AuthProvider.js`, `client/src/auth/AuthProvider.test.js`, `client/src/config/ConfigProvider.js`, `client/src/screens/LoginPage.js`, `client/src/screens/LoginPage.test.js`, `client/src/theme.css`, `client/src/shell/AppShell.js`
- Modify: `client/src/index.js`, `client/src/App.js` (replace with route outlet + `AppShell` or delete and mount shell from `index.js`)
- Delete: `client/src/user-provider.js`, `client/src/app-provider.js`, `client/src/celoskovi.js`, entire `client/src/volejbalalaci/` (after moving `setupTests.js`)

**Interfaces:**
- Consumes: REST `POST /api/auth/challenge`, `POST /api/auth/consume`, `GET /api/me`, `GET /api/config`, `POST /api/auth/logout`, `POST /api/auth/logout-all`
- Produces: `class ApiError extends Error { constructor({ code, message, status }) }` with those enumerable fields; `async function api(path, { method = "GET", body, token } = {})` — `path` starts with `/api/...`; attaches Bearer when `token` or `localStorage.sessionToken` is set; JSON body when `body` is an object; on `fetch` throw → `ApiError({ code: "network", message: errorCopy("network"), status: 0 })`; on `!res.ok` parse JSON and throw `ApiError`; on 401 after a token was sent, call `clearSession()` if provided via `setOnUnauthorized(fn)` in `client.js`; `errorCopy(code)` returns Czech string; `AuthProvider` value `{ user, token, status, requestChallenge(email), consumeToken(token), logout(), logoutAll() }` where `status` is `"loading" | "anon" | "ready"`; **export `useAuth()`** from `AuthProvider.js`; `ConfigProvider` value `{ config }` with at least `{ vapidPublicKey, instanceName, instanceIcon, featureRides }`; **export `useConfig()`**

- [ ] **Step 1: setupTests + failing api/login tests**

`client/src/setupTests.js`:

```javascript
import "@testing-library/jest-dom";
```

`client/src/api/error-copy.js` — implement in step 3; tests import it.

`client/src/api/client.test.js`:

```javascript
import { api, ApiError, setOnUnauthorized } from "./client";
import { errorCopy } from "./error-copy";

afterEach(() => {
  localStorage.clear();
  setOnUnauthorized(null);
  global.fetch = undefined;
});

test("api attaches Bearer from sessionToken and returns JSON", async () => {
  localStorage.setItem("sessionToken", "abc");
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "1" }),
  });
  const data = await api("/api/me");
  expect(data.id).toBe("1");
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer abc" }),
    })
  );
});

test("api throws ApiError with code from JSON body", async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ code: "capacityExceeded", message: "full" }),
  });
  await expect(api("/api/x", { method: "PUT", body: {} })).rejects.toMatchObject({
    code: "capacityExceeded",
    status: 409,
  });
  expect(errorCopy("capacityExceeded")).toMatch(/kapacit/i);
});
```

`client/src/screens/LoginPage.test.js`:

```javascript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoginPage from "./LoginPage";

function renderLogin(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

test("consume stores session token and leaves /login", async () => {
  localStorage.clear();
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url === "/api/auth/consume") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          token: "sess-1",
          user: { id: "u1", name: "Ivo", nickname: "ivo", role: "admin" },
        }),
      });
    }
    if (url === "/api/me") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: "u1",
          name: "Ivo",
          nickname: "ivo",
          role: "admin",
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
  renderLogin("?token=challenge-hex");
  await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument());
  expect(localStorage.getItem("sessionToken")).toBe("sess-1");
  expect(screen.queryByText(/e-mail/i)).not.toBeInTheDocument();
});
```

LoginPage must wrap with AuthProvider in the test if consume lives there — if `LoginPage` calls `api` directly for consume, the test above is enough. Prefer: `LoginPage` uses `AuthProvider.consumeToken`. Then wrap:

```javascript
import { AuthProvider } from "../auth/AuthProvider";
// wrap MemoryRouter children with AuthProvider
```

`consumeToken` must `POST /api/auth/consume` `{ token }`, `localStorage.setItem("sessionToken", body.token)`, set user from `body.user`.

- [ ] **Step 2: Run tests — must fail**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/api/client.test.js src/screens/LoginPage.test.js
```

Expected: FAIL (modules missing).

- [ ] **Step 3: Implement api, error copy, AuthProvider, ConfigProvider, LoginPage, theme, new index routes; delete old files**

`errorCopy` map (exact keys): `dtoInIsNotValid` → `Neplatné údaje`; `unauthorized` → `Nejsi přihlášený`; `forbidden` → `Nemáš oprávnění`; `userNotFound` → `Uživatel neexistuje`; `eventNotFound` → `Termín neexistuje`; `messageNotFound` → `Zpráva neexistuje`; `emailAlreadyExists` → `E-mail už existuje`; `nicknameAlreadyExists` → `Přezdívka už existuje`; `lastAdmin` → `Nelze odebrat posledního správce`; `capacityExceeded` → `Kapacita je plná`; `eventCancelled` → `Termín je zrušený`; `pushNotConfigured` → `Oznámení nejsou nastavená`; `network` → `Nejde se spojit se serverem`; unknown code → `message` from server or `Něco se pokazilo`.

`api()`: `Content-Type: application/json` when `body` is set. 401 + token was sent → `onUnauthorized` then throw.

`LoginPage`: email form, submit `POST /api/auth/challenge`, always success text `Když účet existuje, přišel ti e-mail s odkazem.` On `useSearchParams().get("token")` call `consumeToken` then `navigate("/", { replace: true })`. Consume error: inline `Alert`.

`theme.css`:

```css
:root {
  --vb-blue: #1e4fa3;
  --vb-red: #d0121a;
  --vb-bg: #ffffff;
  --vb-text: #1a1a1a;
}
body { background: var(--vb-bg); color: var(--vb-text); }
.navbar-vb { background: var(--vb-blue); }
.btn-primary { background-color: var(--vb-blue); border-color: var(--vb-blue); }
```

`AppShell`: for Task 1, simple navbar with brand from `config.instanceName || "Volejbalaláci"`; links can 404 until later tasks — still render Nástěnka `/board`, Termíny `/events`. Členové only if `user.role === "admin"`. Logout / logout-all wired.

`index.js`: `BrowserRouter` → `ConfigProvider` → `AuthProvider` → routes: `/login` public; all other routes wrapped in a `RequireAuth` that redirects to `/login` while `status === "anon"`; `/` placeholder `<div>home</div>` until Task 2 (Login test needs `/` to say `home` — use a tiny `HomePlaceholder` with text `home` **or** change the login test to assert `navigate` to `/` and `sessionToken` without requiring the word `home`. Prefer asserting pathname: wrap with a `LocationDisplay`. Then Task 2 can replace `/`.)

**Login test adjustment (use this instead of looking for "home"):**

```javascript
import { useLocation } from "react-router-dom";
function Path() {
  const loc = useLocation();
  return <div>{loc.pathname}</div>;
}
// after consume, screen.getByText("/") 
```

Routes: `/login` and `/*` RequireAuth with Path or real Home later.

Set `document.title` from config. If `config.instanceIcon` is non-empty URL, set favicon `href`.

- [ ] **Step 4: Tests pass**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/api/client.test.js src/screens/LoginPage.test.js
```

- [ ] **Step 5: Commit**

```bash
git add client && git commit -m "$(cat <<'EOF'
feat: add REST api client, magic-link login, and app shell

EOF
)"
```

Do not add lockfile or `.env`.

---

### Task 2: Events, nearest `/` redirect, RSVP, create/edit/cancel/bulk

**Files:**
- Create: `client/src/events/pickNearestScheduled.js`, `client/src/events/pickNearestScheduled.test.js`, `client/src/screens/HomePage.js`, `client/src/screens/HomePage.test.js`, `client/src/screens/EventListPage.js`, `client/src/screens/EventDetailPage.js`, `client/src/screens/EventDetailPage.test.js`, `client/src/events/EventForm.js`, `client/src/events/BulkEventForm.js`, `client/src/users/UsersProvider.js`
- Modify: `client/src/index.js` (`/` → `HomePage`, `/events`, `/events/:id`)

**Interfaces:**
- Consumes: `api`, `AuthProvider.user`, `errorCopy`; REST events + attendances
- Produces: `pickNearestScheduled(events)` — `events` is array of `{ id, startAt, status }`; returns the item with `status === "scheduled"` and smallest `startAt` among those with `startAt >= now` **when the caller already fetched default list** (list is already `startAt >= now`). Implementation: filter `status === "scheduled"`, sort by `startAt` ascending, return `[0]` or `null`. Do **not** treat cancelled as nearest. `UsersProvider` + **`useUsers()`** → `{ users, displayName(id) }` (`displayName` = name or nickname or `id.slice(0, 8)`).

- [ ] **Step 1: Failing tests**

`pickNearestScheduled.test.js`:

```javascript
import { pickNearestScheduled } from "./pickNearestScheduled";

test("picks earliest scheduled, skips cancelled", () => {
  const a = { id: "c", startAt: "2030-01-02T10:00:00.000Z", status: "cancelled" };
  const b = { id: "s", startAt: "2030-01-03T10:00:00.000Z", status: "scheduled" };
  const c = { id: "s0", startAt: "2030-01-01T10:00:00.000Z", status: "scheduled" };
  expect(pickNearestScheduled([a, b, c]).id).toBe("s0");
});

test("returns null when none scheduled", () => {
  expect(pickNearestScheduled([{ id: "c", startAt: "2030-01-01T10:00:00.000Z", status: "cancelled" }])).toBeNull();
});
```

`HomePage.test.js`: mock `api` module:

```javascript
jest.mock("../api/client", () => ({
  api: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor({ code, message, status }) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
}));
```

Use `MemoryRouter` + `AuthProvider` is heavy; mock `api` to resolve `GET /api/events` with one scheduled event and assert `navigate` to `/events/THAT_ID`.

Simplest: `HomePage` calls `pickNearestScheduled` after `api("/api/events")` then `<Navigate to={`/events/${id}`} replace />`.

`EventDetailPage.test.js` — RSVP 409:

```javascript
test("RSVP 409 does not replace local attendance with the failed payload", async () => {
  // initial GET event + GET attendances: user u1 status maybe
  // PUT /attendances/me yes → reject ApiError capacityExceeded
  // after click Ano, still show maybe (or the previous status), and alert with kapacit
});
```

Wire `UsersProvider` so names resolve; in this test `users` can be `[{ id: "u1", name: "Ivo" }]`.

- [ ] **Step 2: Run — fail**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/events/pickNearestScheduled.test.js src/screens/HomePage.test.js src/screens/EventDetailPage.test.js
```

- [ ] **Step 3: Implement**

`HomePage`: loading spinner; `api("/api/events")`; nearest → `<Navigate>`; else empty copy `Zatím žádný termín.` Admin (`user.role === "admin"`) shows buttons opening `EventForm` / `BulkEventForm`.

`EventListPage`: cards (`occupied / capacity`, cancelled `Badge` bg danger). Click → `/events/:id`. Admin create/bulk. Load error: `Alert`.

`EventDetailPage`: parallel `api("/api/events/"+id)` and `api("/api/events/"+id+"/attendances")`. Occupancy from `event.occupied`. RSVP buttons: Ano (primary/blue), Ne (outline + red text/border), Možná (neutral/light). Guests number 0–6 visible only when status is yes. Note textarea max 280. `PUT /api/events/${id}/attendances/me`. On `ApiError`, show `errorCopy(err.code)` and **do not** set local attendance to the attempted body. Cancelled: disable RSVP. Admin: Upravit, Zrušit (`POST .../cancel`), optional attendance for another user via select + same PUT path `.../attendances/${userId}`.

`EventForm`: controlled fields; POST or PATCH; never send `status` / `reminderSentAt`. `BulkEventForm`: header + dynamic occurrence rows; `POST /api/events/bulk`; success `navigate("/events")`.

`UsersProvider`: fetch `/api/users` when auth ready; `displayName(id)` = name or nickname or `id.slice(0, 8)`.

- [ ] **Step 4: Tests pass + login tests still pass**

```bash
cd client && CI=true npx react-scripts test --watchAll=false
```

- [ ] **Step 5: Commit** `feat: add event list, nearest-home redirect, and RSVP`

---

### Task 3: Board and event messages

**Files:**
- Create: `client/src/messages/groupMessages.js`, `client/src/messages/groupMessages.test.js`, `client/src/messages/MessageThread.js`, `client/src/screens/BoardPage.js`
- Modify: `client/src/screens/EventDetailPage.js` (mount thread), `client/src/index.js` (`/board`)

**Interfaces:**
- Consumes: `api`, `UsersProvider.displayName`, `AuthProvider.user`
- Produces: `groupMessages(flat)` — `flat` is `{ id, body, userId, replyToId, createdAt }[]` already sorted by `createdAt`. Returns `{ roots, repliesByParent }` where `roots` are items with falsy `replyToId`, `repliesByParent[parentId]` is array of replies. Reply UI only on roots.

- [ ] **Step 1: Failing test**

```javascript
import { groupMessages } from "./groupMessages";

test("groups one-level replies under roots", () => {
  const root = { id: "r", body: "a", replyToId: null, createdAt: "1" };
  const reply = { id: "c", body: "b", replyToId: "r", createdAt: "2" };
  const g = groupMessages([root, reply]);
  expect(g.roots.map((x) => x.id)).toEqual(["r"]);
  expect(g.repliesByParent.r.map((x) => x.id)).toEqual(["c"]);
});
```

- [ ] **Step 2: Run fail**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/messages/groupMessages.test.js
```

- [ ] **Step 3: Implement**

`BoardPage`: `api("/api/messages")` (no query). `MessageThread` `eventId={null}`.

`MessageThread({ eventId })`: load as above; `eventId` string → `api("/api/messages?eventId="+eventId)`. Post `{ body }` plus `eventId` if non-null; reply adds `replyToId` of a **root**. Patch/delete if `user.id === message.userId || user.role === "admin"`. Body max 2000. Indent replies. Author label `displayName(userId)`.

Event detail: cancelled still mounts `MessageThread`.

- [ ] **Step 4: Full client test suite pass**

- [ ] **Step 5: Commit** `feat: add board and per-event message threads`

---

### Task 4: Members admin

**Files:**
- Create: `client/src/screens/UsersPage.js`, `client/src/screens/UsersPage.test.js`, `client/src/shell/AppShell.test.js`
- Modify: `client/src/index.js` (`/users`), `client/src/shell/AppShell.js`

**Interfaces:**
- Consumes: `api`, `AuthProvider.user`
- Produces: `/users` screen; nav **Členové** iff `user.role === "admin"`

- [ ] **Step 1: Failing test (spec: non-admin does not see Členové)**

```javascript
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppShell from "./AppShell";

const Config = { config: { instanceName: "Volejbalaláci", vapidPublicKey: null } };
// If AppShell reads context, wrap with fake providers:

test("non-admin does not see Členové", () => {
  render(
    <MemoryRouter>
      {/* provide user role user, config, children */}
      <AppShell />
    </MemoryRouter>
  );
  expect(screen.queryByRole("link", { name: /členové/i })).not.toBeInTheDocument();
});

test("admin sees Členové", () => {
  // role admin
  expect(screen.getByRole("link", { name: /členové/i })).toBeInTheDocument();
});
```

Export a testable `AppShell` that takes `user` from `useAuth()`. Provide `AuthContext` in test via wrapping `AuthProvider` with mocked `api("/api/me")` **or** export `AppShellView({ user, config, ... })` presentational and test that — prefer **not** splitting unless context makes tests brittle. Mock `useAuth` if the file exports a hook.

If `AuthProvider` is hard to mock, pass optional `user` prop override only in tests is forbidden for prod API — use a wrapper:

```javascript
jest.mock("../auth/AuthProvider", () => {
  const React = require("react");
  const Ctx = React.createContext();
  return {
    useAuth: () => React.useContext(Ctx),
    AuthProvider: ({ value, children }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>,
  };
});
```

Do **not** mock if `useAuth` is not already exported — **export `useAuth` from AuthProvider in Task 1** (if Task 1 missed it, export now). Same `useConfig`.

`UsersPage`: if `user.role !== "admin"` render `Nemáš oprávnění.` (no table). Else table + create/edit forms. No delete. 409 show `errorCopy`. Disable demote when `users.filter(u => u.role==="admin").length === 1` and target is that admin.

- [ ] **Step 2: Run fail**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/shell/AppShell.test.js
```

- [ ] **Step 3: Implement page + route**

- [ ] **Step 4: Full suite**

- [ ] **Step 5: Commit** `feat: add admin member list and forms`

---

### Task 5: PWA install, push, service worker

**Files:**
- Create: `client/src/pwa/useInstallPrompt.js`, `client/src/pwa/usePushSubscription.js`, `client/src/pwa/usePushSubscription.test.js`, `client/public/sw.js`
- Modify: `client/src/shell/AppShell.js` (menu items), `client/src/index.js` (register `/sw.js`), `client/public/manifest.json` (name Volejbalaláci, `display: standalone`, theme `#1e4fa3`, background `#ffffff`)

**Interfaces:**
- Consumes: `useConfig().config.vapidPublicKey`, `api("/api/push/subscribe")`
- Produces: `useInstallPrompt()` → `{ canInstall, install() }` — `canInstall` true iff captured `beforeinstallprompt` event exists AND `window.matchMedia("(display-mode: standalone)").matches` is false. `install()` calls `event.prompt()` then clears the event. `usePushSubscription()` → `{ canEnable, canDisable, enable(), disable() }` — `canEnable` true iff `vapidPublicKey` and no current `PushSubscription`; `canDisable` iff subscription exists. `enable` requests permission, `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) })`, `api("/api/push/subscribe", { method: "POST", body: sub.toJSON() })`. 503 → treat as cannot enable. `disable` DELETE `{ endpoint }` then `sub.unsubscribe()`.

- [ ] **Step 1: Failing test (spec: without vapid, Zapnout oznámení absent)**

Test `AppShell` with `vapidPublicKey: null` and assert no button/menuitem `Zapnout oznámení`. With a fake vapid string and mocked `navigator.serviceWorker` / `pushManager.getSubscription` resolving `null`, the item is present.

```javascript
test("without vapidPublicKey, Zapnout oznámení is absent", () => {
  // render shell with config vapidPublicKey: null, user logged in
  expect(screen.queryByText(/zapnout oznámení/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run fail**

```bash
cd client && CI=true npx react-scripts test --watchAll=false src/pwa/usePushSubscription.test.js src/shell/AppShell.test.js
```

- [ ] **Step 3: Implement hooks, menu entries, sw.js**

`public/sw.js`:

```javascript
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Volejbalaláci", {
      body: data.body || "",
      data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let path = "/";
  if (data.type === "message" && (data.eventId == null || data.eventId === "")) {
    path = "/board";
  } else if (data.type === "message" && data.eventId) {
    path = "/events/" + data.eventId;
  } else if (data.type === "reminder" && data.eventId) {
    path = "/events/" + data.eventId;
  }
  event.waitUntil(clients.openWindow(path));
});
```

Register in `index.js`: `if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js")`.

**Nainstalovat** only when `canInstall`. **Zapnout** / **Vypnout** per hook. No auto prompt.

Convert VAPID public key with standard url-safe base64 → `Uint8Array` helper in `usePushSubscription.js`.

- [ ] **Step 4: Full `CI=true npx react-scripts test --watchAll=false` — 0 fail**

- [ ] **Step 5: Commit** `feat: add PWA install prompt and Web Push subscription`

---

## Spec coverage

| Spec item | Task |
|---|---|
| `api` / `ApiError` / Czech map / 401 → login | 1 |
| Magic link challenge + consume + `sessionToken` | 1 |
| Strip Celoškovi / old DAO client | 1 |
| Ball palette CSS, one navbar | 1 (tokens) + 5 (install/push items) |
| `/` nearest scheduled, empty state, list+detail, RSVP, occupancy, cancel, bulk | 2 |
| RSVP 409 keeps old state | 2 |
| Board + event messages, one-level replies | 3 |
| Members admin, Členové hidden for user | 4 |
| Install gesture, push gesture, SW click routes, no vapid → no Zapnout | 5 |
| Rides UI | out of scope |
| Playwright / auto PWA prompt | out of scope |
