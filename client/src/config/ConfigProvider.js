import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";

const ConfigContext = createContext(null);

const DEFAULT_CONFIG = {
  vapidPublicKey: null,
  instanceName: undefined,
  instanceIcon: undefined,
  featureRides: false,
};

function applyDocumentChrome(config) {
  document.title = config.instanceName || "Volejbalaláci";
  if (config.instanceIcon) {
    const link = document.getElementById("favicon");
    if (link) {
      link.setAttribute("href", config.instanceIcon);
    }
  }
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    let cancelled = false;
    applyDocumentChrome(DEFAULT_CONFIG);
    (async () => {
      try {
        const data = await api("/api/config", { token: null });
        if (cancelled) {
          return;
        }
        const next = {
          vapidPublicKey: data.vapidPublicKey ?? null,
          instanceName: data.instanceName,
          instanceIcon: data.instanceIcon,
          featureRides: Boolean(data.featureRides),
        };
        setConfig(next);
        applyDocumentChrome(next);
      } catch {
        if (!cancelled) {
          applyDocumentChrome(DEFAULT_CONFIG);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ config }), [config]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig must be used within ConfigProvider");
  }
  return ctx;
}
