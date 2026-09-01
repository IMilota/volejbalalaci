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
