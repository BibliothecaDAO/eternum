import { applyWorldSelection, getActiveWorldName } from "@/runtime/world";
import { openWorldSelectorModal } from "@/ui/features/world-selector";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { SignInPromptModal } from "@/ui/layouts/sign-in-prompt-modal";
import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { createElement, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env as gameEnv } from "../../../env";

export const useGameSelector = () => {
  const navigate = useNavigate();
  const [activeWorld, setActiveWorld] = useState<string | null>(null);
  const account = useAccountStore((state) => state.account);
  const { isConnected } = useAccount();
  const setModal = useUIStore((state) => state.setModal);

  useEffect(() => {
    setActiveWorld(getActiveWorldName());
  }, []);

  const selectGame = async (options?: { navigateAfter?: boolean; navigateTo?: string }) => {
    const { navigateAfter = false, navigateTo = "/play" } = options || {};
    const targetingPlayRoute = navigateTo.startsWith("/play");
    const hasAccount = Boolean(account) || isConnected;

    try {
      const currentWorld = getActiveWorldName();
      const firstSelection = !currentWorld;

      const selection = await openWorldSelectorModal();
      const { chainChanged } = await applyWorldSelection(selection, gameEnv.VITE_PUBLIC_CHAIN as Chain);
      setActiveWorld(selection.name);

      // If this is the first ever selection (after clearing storage), prefer a smooth client-side
      // navigation to the play route so users land in the game automatically.
      if (firstSelection && !chainChanged) {
        if (navigateAfter && targetingPlayRoute && !hasAccount) {
          setModal(createElement(SignInPromptModal), true);
          return;
        }

        if (window.location.pathname !== navigateTo) {
          navigate(navigateTo);
        }
        return;
      }

      const worldChanged = selection.name !== currentWorld;
      const shouldReload = chainChanged || worldChanged;

      // Subsequent selections: if the world changed, force reload to reinitialize indexers/providers.
      if (shouldReload) {
        if (navigateAfter) {
          if (targetingPlayRoute && !hasAccount && !chainChanged) {
            setModal(createElement(SignInPromptModal), true);
            return;
          }
          window.location.href = navigateTo;
        } else {
          window.location.reload();
        }
      } else if (navigateAfter) {
        if (targetingPlayRoute && !hasAccount) {
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
