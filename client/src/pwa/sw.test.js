const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadServiceWorker() {
  const code = fs.readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  const listeners = {};
  const openWindow = jest.fn();
  const showNotification = jest.fn();
  const skipWaiting = jest.fn().mockResolvedValue(undefined);
  const claim = jest.fn().mockResolvedValue(undefined);
  const cacheDelete = jest.fn().mockResolvedValue(true);
  const context = {
    URL,
    self: {
      skipWaiting,
      clients: { claim },
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
      registration: { showNotification },
    },
    clients: { openWindow, claim },
    caches: {
      keys: jest.fn().mockResolvedValue(["old-cache", "volejbalalaci-runtime-v1"]),
      delete: cacheDelete,
      match: jest.fn(),
    },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { listeners, openWindow, showNotification, skipWaiting, claim, cacheDelete };
}

function clickNotification(listeners, data) {
  const waitUntil = jest.fn();
  listeners.notificationclick({
    notification: { close: jest.fn(), data },
    waitUntil,
  });
  return waitUntil;
}

test("message with null eventId opens /events", () => {
  const { listeners, openWindow } = loadServiceWorker();
  clickNotification(listeners, { type: "message", eventId: null });
  expect(openWindow).toHaveBeenCalledWith("/events");
});

test("message with eventId opens /events/:id", () => {
  const { listeners, openWindow } = loadServiceWorker();
  clickNotification(listeners, { type: "message", eventId: "evt-9" });
  expect(openWindow).toHaveBeenCalledWith("/events/evt-9");
});

test("reminder with eventId opens /events/:id", () => {
  const { listeners, openWindow } = loadServiceWorker();
  clickNotification(listeners, { type: "reminder", eventId: "evt-2" });
  expect(openWindow).toHaveBeenCalledWith("/events/evt-2");
});

test("install skips waiting and activate claims clients", async () => {
  const { listeners, skipWaiting, claim, cacheDelete } = loadServiceWorker();
  const installWait = jest.fn();
  listeners.install({ waitUntil: installWait });
  await installWait.mock.calls[0][0];
  expect(skipWaiting).toHaveBeenCalled();

  const activateWait = jest.fn();
  listeners.activate({ waitUntil: activateWait });
  await activateWait.mock.calls[0][0];
  expect(cacheDelete).toHaveBeenCalledWith("old-cache");
  expect(claim).toHaveBeenCalled();
});

test("does not intercept /api fetches", () => {
  const { listeners } = loadServiceWorker();
  const respondWith = jest.fn();
  listeners.fetch({
    request: { url: "http://localhost/api/events", mode: "navigate" },
    respondWith,
  });
  expect(respondWith).not.toHaveBeenCalled();
});
