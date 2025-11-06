import { getActiveWorldName, setActiveWorldName } from "@/runtime/world";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { openWorldSelectorModal } from "@/ui/features/world-selector";
import type { Chain } from "@contracts";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env as gameEnv } from "../../../env";

export const useGameSelector = () => {
  const navigate = useNavigate();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);

  useEffect(() => {
    setActiveWorld(getActiveWorldName());
  }, []);

  const selectGame = async (options?: { navigateAfter?: boolean; navigateTo?: string }) => {
    const { navigateAfter = false, navigateTo = "/play" } = options || {};

    try {
      const currentWorld = getActiveWorldName();
      const firstSelection = !currentWorld;

      const name = await openWorldSelectorModal();
      const chain = gameEnv.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, name);
      setActiveWorldName(name);
      setActiveWorld(name);

      // If this is the first ever selection (after clearing storage), prefer a smooth client-side
      // navigation to the play route so users land in the game automatically.
      if (firstSelection) {
        if (window.location.pathname !== navigateTo) {
          navigate(navigateTo);
        } else {
          // Already on target; no-op (bootstrap/onboarding handles the rest)
        }
        return;
      }

      // Subsequent selections: if the world changed, force reload to reinitialize indexers/providers.
      if (name !== currentWorld) {
        if (navigateAfter) {
          window.location.href = navigateTo;
        } else {
          window.location.reload();
        }
      } else if (navigateAfter) {
        // Same world selected, just navigate normally
        navigate(navigateTo);
      }
    } catch {
      // User cancelled modal
    }
  };

  return {
    activeWorld,
    selectGame,
  };
};
