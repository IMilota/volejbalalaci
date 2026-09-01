function scriptUrl() {
  return process.env.NODE_ENV === "production"
    ? `${process.env.PUBLIC_URL}/service-worker.js`
    : "/sw.js";
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(scriptUrl(), { scope: "/" });
  });
}

registerServiceWorker();
