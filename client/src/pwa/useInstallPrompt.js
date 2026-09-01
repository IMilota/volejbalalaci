import { useCallback, useEffect, useState } from "react";

function isStandalone() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);

  useEffect(() => {
    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferred(event);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    setDeferred(null);
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !isStandalone(),
    install,
  };
}
