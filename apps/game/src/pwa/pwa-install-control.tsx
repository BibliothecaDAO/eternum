import { useEffect, useId, useState } from "react";
import { create } from "zustand";
import { HUD_PILL_BUTTON } from "@/ui/design-system/atoms/overlay-surface";
import { isInstalledPwa, pwaInstallInstructions } from "./browser-capabilities";

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
const useInstallState = create<{ prompt: InstallPrompt | null; installed: boolean }>(() => ({
  prompt: null,
  installed: false,
}));

/** Listen at the app root so opening Settings later cannot miss Chrome's install event. */
export function PwaInstallRuntime() {
  useEffect(() => {
    useInstallState.setState({ installed: isInstalledPwa() });
    const ready = (event: Event) => {
      if (typeof (event as InstallPrompt).prompt !== "function") return;
      event.preventDefault();
      useInstallState.setState({ prompt: event as InstallPrompt });
    };
    const installed = () => useInstallState.setState({ installed: true, prompt: null });
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}

export function PwaInstallControl() {
  const { installed } = useInstallState();
  const [help, setHelp] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const helpId = useId();
  if (installed) return null;

  const install = async () => {
    const { prompt } = useInstallState.getState();
    if (!prompt) {
      setHelp((shown) => !shown);
      return;
    }
    useInstallState.setState({ prompt: null });
    setPending(true);
    setError(null);
    try {
      // Keep prompt() inside this user gesture; permission and worker registration are separate actions.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setHelp(choice.outcome === "dismissed");
    } catch {
      setError("The install prompt is unavailable. You can still install from the browser menu.");
      setHelp(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <section aria-label="Install game" className="max-w-sm space-y-2">
      <button
        type="button"
        className={HUD_PILL_BUTTON}
        disabled={pending}
        aria-expanded={help}
        aria-controls={helpId}
        onClick={() => {
          void install();
        }}
      >
        {pending ? "Installing…" : "Install Realms"}
      </button>
      {help && (
        <div id={helpId} className="rounded-lg border border-gold/20 bg-black/80 p-3 text-sm text-gold/90">
          <p>{pwaInstallInstructions()}</p>
          <p className="mt-2 text-xs text-gold/60">
            Already installed? Open Realms from your Home Screen, Dock, or app launcher. Playing requires an internet
            connection.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
