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
      const name = await openWorldSelectorModal();
      const chain = gameEnv.VITE_PUBLIC_CHAIN as Chain;
      await buildWorldProfile(chain, name);
      setActiveWorldName(name);
      setActiveWorld(name);

      // Only reload if a different world was selected
      if (name !== currentWorld) {
        // Force a full page reload to reinitialize the indexer with new world
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
