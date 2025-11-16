import { getActiveWorldName, setActiveWorldName } from "@/runtime/world";
import { buildWorldProfile } from "@/runtime/world/profile-builder";
import { openWorldSelectorModal } from "@/ui/features/world-selector";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import type { Chain } from "@contracts";
import { createElement, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env as gameEnv } from "../../../env";

export const useGameSelector = () => {
  const navigate = useNavigate();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);
   const account = useAccountStore((state) => state.account);
   const setModal = useUIStore((state) => state.setModal);

  useEffect(() => {
    setActiveWorld(getActiveWorldName());
  }, []);

  const selectGame = async (options?: { navigateAfter?: boolean; navigateTo?: string }) => {
    const { navigateAfter = false, navigateTo = "/play" } = options || {};
    const targetingPlayRoute = navigateTo.startsWith("/play");

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
        if (navigateAfter && targetingPlayRoute && !account) {
          setModal(createElement(SignInPromptModal), true);
          return;
        }

        if (window.location.pathname !== navigateTo) {
          navigate(navigateTo);
        }
        return;
      }

      const worldChanged = name !== currentWorld;

      // Subsequent selections: if the world changed, force reload to reinitialize indexers/providers.
      if (worldChanged) {
        if (navigateAfter) {
          if (targetingPlayRoute && !account) {
            setModal(createElement(SignInPromptModal), true);
            return;
          }
          window.location.href = navigateTo;
        } else {
          window.location.reload();
        }
      } else if (navigateAfter) {
        if (targetingPlayRoute && !account) {
          setModal(createElement(SignInPromptModal), true);
          return;
        }
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
