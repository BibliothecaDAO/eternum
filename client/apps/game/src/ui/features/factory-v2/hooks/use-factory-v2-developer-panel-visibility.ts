import { useRef, useState } from "react";

const DEV_TOOLS_STORAGE_KEY = "factory-v2-developer-tools-visible";
const DEV_TOOLS_TAP_WINDOW_MS = 2_000;
const DEV_TOOLS_TAP_COUNT = 5;

function readDeveloperToolsVisibility(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(DEV_TOOLS_STORAGE_KEY) === "true";
}

function writeDeveloperToolsVisibility(isVisible: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DEV_TOOLS_STORAGE_KEY, String(isVisible));
}

export const useFactoryV2DeveloperPanelVisibility = () => {
  const [isVisible, setIsVisible] = useState(readDeveloperToolsVisibility);
  const revealTapTimestampsRef = useRef<number[]>([]);

  const registerRevealTap = () => {
    const now = Date.now();
    const recentTapTimestamps = [...revealTapTimestampsRef.current, now].filter(
      (timestamp) => now - timestamp <= DEV_TOOLS_TAP_WINDOW_MS,
    );

    if (recentTapTimestamps.length < DEV_TOOLS_TAP_COUNT) {
      revealTapTimestampsRef.current = recentTapTimestamps;
      return;
    }

    const nextVisibility = !isVisible;
    revealTapTimestampsRef.current = [];
    setIsVisible(nextVisibility);
    writeDeveloperToolsVisibility(nextVisibility);
  };

  return {
    isVisible,
    registerRevealTap,
  };
};
