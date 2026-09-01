import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { useConfig } from "../config/ConfigProvider";

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const { config } = useConfig();
  const vapidPublicKey = config.vapidPublicKey;
  const [subscription, setSubscription] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vapidPublicKey || !("serviceWorker" in navigator)) {
        if (!cancelled) {
          setSubscription(null);
          setReady(true);
        }
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const current = await registration.pushManager.getSubscription();
        if (!cancelled) {
          setSubscription(current);
        }
      } catch {
        if (!cancelled) {
          setSubscription(null);
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = useCallback(async () => {
    if (!vapidPublicKey || !("serviceWorker" in navigator) || !global.Notification) {
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    try {
      await api("/api/push/subscribe", { method: "POST", body: sub.toJSON() });
      setSubscription(sub);
      setUnavailable(false);
    } catch (err) {
      if (err && err.status === 503) {
        setUnavailable(true);
        setSubscription(null);
        try {
          await sub.unsubscribe();
        } catch {
          // browser may already have dropped the subscription
        }
      }
    }
  }, [vapidPublicKey]);

  const disable = useCallback(async () => {
    if (!subscription) {
      return;
    }
    await api("/api/push/subscribe", {
      method: "DELETE",
      body: { endpoint: subscription.endpoint },
    });
    await subscription.unsubscribe();
    setSubscription(null);
  }, [subscription]);

  const canEnable =
    Boolean(vapidPublicKey) &&
    !subscription &&
    !unavailable &&
    ready &&
    "serviceWorker" in navigator;
  const canDisable = Boolean(vapidPublicKey) && Boolean(subscription) && !unavailable;

  return { canEnable, canDisable, enable, disable };
}
