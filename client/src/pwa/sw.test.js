const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadServiceWorker() {
  const code = fs.readFileSync(path.resolve(__dirname, "../../public/sw.js"), "utf8");
  const listeners = {};
  const openWindow = jest.fn();
  const showNotification = jest.fn();
  const context = {
    self: {
      addEventListener(type, handler) {
        listeners[type] = handler;
      },
      registration: { showNotification },
    },
    clients: { openWindow },
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return { listeners, openWindow, showNotification };
}

function clickNotification(listeners, data) {
  const waitUntil = jest.fn();
  listeners.notificationclick({
    notification: { close: jest.fn(), data },
    waitUntil,
  });
  return waitUntil;
}

test("message with null eventId opens /board", () => {
  const { listeners, openWindow } = loadServiceWorker();
  clickNotification(listeners, { type: "message", eventId: null });
  expect(openWindow).toHaveBeenCalledWith("/board");
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
