import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { useEffect } from "react";
import { create } from "zustand";

import { APP_STATE_WORDS } from "@/shell/words";
import { Button } from "@/ui/design-system/kit/button";

import { Sheet } from "@/ui/design-system/kit/sheet";

import { isAppleMobile, isInstalledPwa } from "./browser-capabilities";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const useInstallState = create<{ prompt: InstallPrompt | null; installed: boolean; steps: boolean }>(() => ({
  prompt: null,
  installed: false,
  steps: false,
}));

/**
 * Listen at the app root so a later Install cannot miss Chrome's install event, and hold the install steps' sheet for
 * browsers that offer no prompt (Safari).
 */
export function PwaInstallRuntime() {
  const steps = useInstallState((state) => state.steps);
  useEffect(() => {
    useInstallState.setState({ installed: isInstalledPwa() });
    const ready = (event: Event) => {
      if (typeof (event as InstallPrompt).prompt !== "function") return;
      event.preventDefault();
      useInstallState.setState({ prompt: event as InstallPrompt });
    };
    const installed = () => useInstallState.setState({ installed: true, prompt: null, steps: false });
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return steps ? <InstallSheet onClose={() => useInstallState.setState({ steps: false })} /> : null;
}

/** Install: the browser's own prompt where it offers one (Chrome, Edge), else its steps as pictograms in a sheet. */
export const useInstall = () => {
  const installed = useInstallState((state) => state.installed);
  const install = async () => {
    const { prompt } = useInstallState.getState();
    if (!prompt) return useInstallState.setState({ steps: true });
    useInstallState.setState({ prompt: null });
    // Keep prompt() inside this user gesture.
    await prompt.prompt();
    await prompt.userChoice;
  };
  return { installed, install };
};

/** The game's Settings: Install, until the app is installed. */
export function PwaInstallControl() {
  const { installed, install } = useInstall();
  if (installed) return null;
  return <Button role="outline" word={APP_STATE_WORDS.install} icon="download" onClick={() => void install()} />;
}

/** The browser's steps, as its own words on pictograms: Safari on an iPhone, or on a Mac. */
const InstallSheet = ({ onClose }: { onClose: () => void }) => {
  const steps: [IconMeaning, string][] = isAppleMobile()
    ? [
        ["share", APP_STATE_WORDS.share],
        ["download", APP_STATE_WORDS.addToHomeScreen],
        ["check", APP_STATE_WORDS.add],
      ]
    : [
        ["menu", APP_STATE_WORDS.file],
        ["download", APP_STATE_WORDS.addToDock],
      ];
  return (
    <Sheet label={APP_STATE_WORDS.install} onClose={onClose}>
      <ol className="flex flex-col gap-2 py-2">
        {steps.map(([icon, word], index) => (
          <li
            key={word}
            className="flex min-h-14 items-center gap-3 rounded-control border border-kit-line bg-kit-plate px-3"
          >
            <span className="font-body text-xl font-extrabold text-kit-peach">{index + 1}</span>
            <SemanticIcon name={icon} size={28} />
            <span className="font-body text-base font-semibold text-kit-cream">{word}</span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
};
