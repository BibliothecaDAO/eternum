import { useEffect } from "react";

type BootDocumentState = "booting" | "react-mounted" | "app-loading" | "app-ready";

const BOOT_SHELL_ID = "boot-shell";
const TERMINAL_BOOT_STATES: ReadonlySet<BootDocumentState> = new Set(["app-loading", "app-ready"]);

export const markBootMilestone = (name: string) => {
  if (typeof window === "undefined" || typeof window.performance?.mark !== "function") {
    return;
  }

  try {
    window.performance.mark(name);
  } catch {
    // Ignore duplicate or unsupported marks.
  }
};

export const setBootDocumentState = (state: BootDocumentState) => {
  if (typeof document === "undefined") {
    return;
  }

  const rootElement = document.documentElement;
  if (rootElement.dataset.bootState === state) {
    return;
  }

  rootElement.dataset.bootState = state;

  if (TERMINAL_BOOT_STATES.has(state)) {
    document.getElementById(BOOT_SHELL_ID)?.remove();
  }
};

export const useBootDocumentState = (state: BootDocumentState | null, milestone?: string) => {
  useEffect(() => {
    if (state === null) {
      return;
    }

    setBootDocumentState(state);
    if (milestone) {
      markBootMilestone(milestone);
    }
  }, [milestone, state]);
};
