import { create } from "zustand";

export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const useInstallState = create<{ prompt: InstallPrompt | null; installed: boolean; steps: boolean }>(() => ({
  prompt: null,
  installed: false,
  steps: false,
}));

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
