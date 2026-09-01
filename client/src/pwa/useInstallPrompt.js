import { useCallback, useEffect, useState } from "react";
import {
  clearStashedInstallPrompt,
  getStashedInstallPrompt,
  subscribeInstallPrompt,
} from "./installPromptCapture";

function isStandalone() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(getStashedInstallPrompt);

  useEffect(() => subscribeInstallPrompt(setDeferred), []);

  const install = useCallback(async () => {
    if (!deferred) {
      return;
    }
    await deferred.prompt();
    clearStashedInstallPrompt();
  }, [deferred]);

  return {
    canInstall: Boolean(deferred) && !isStandalone(),
    install,
  };
}
