let stashed = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(stashed));
}

function onBeforeInstallPrompt(event) {
  event.preventDefault();
  stashed = event;
  notify();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
}

export function getStashedInstallPrompt() {
  return stashed;
}

export function clearStashedInstallPrompt() {
  stashed = null;
  notify();
}

export function subscribeInstallPrompt(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
