const CACHE_NAME = "volejbalalaci-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : null))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) {
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/index.html"))
    );
  }
});

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
    path = "/events";
  } else if (data.type === "message" && data.eventId) {
    path = "/events/" + data.eventId;
  } else if (data.type === "reminder" && data.eventId) {
    path = "/events/" + data.eventId;
  }
  event.waitUntil(clients.openWindow(path));
});
