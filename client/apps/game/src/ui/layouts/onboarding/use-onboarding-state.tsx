import { ReactNode, useCallback, useMemo, useState } from "react";

import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

import { LocalStepOne } from "@/ui/features/progression";

import { env } from "../../../../env";
import { SeasonPassButton } from "./components/season-pass-button";

type OnboardingStage = "intro" | "settle";

export interface BottomContentContext {
  isLocalChain: boolean;
  handleEnterSettleRealm: () => void;
}

export interface UseOnboardingStateOptions {
  resolveBottomContent?: (context: BottomContentContext) => ReactNode | undefined;
}

interface UseOnboardingStateReturn {
  isSettlingRealm: boolean;
  bottomContent?: ReactNode;
  showBottomContent: boolean;
  handleEnterSettleRealm: () => void;
  handleExitSettleRealm: () => void;
}

export const useOnboardingState = ({
  resolveBottomContent,
}: UseOnboardingStateOptions = {}): UseOnboardingStateReturn => {
  const [stage, setStage] = useState<OnboardingStage>("intro");
  const mode = useGameModeConfig();
  const isLocalChain = env.VITE_PUBLIC_CHAIN === "local";

  const handleEnterSettleRealm = useCallback(() => {
    setStage("settle");
  }, []);

  const handleExitSettleRealm = useCallback(() => {
    setStage("intro");
  }, []);

  const bottomContent = useMemo(() => {
    if (resolveBottomContent) {
      return resolveBottomContent({
        isLocalChain,
        handleEnterSettleRealm,
      });
    }

    if (!mode.ui.showMintCta) {
      return undefined;
    }

    if (isLocalChain) {
      return <LocalStepOne />;
    }

    return <SeasonPassButton onSettleRealm={handleEnterSettleRealm} />;
  }, [handleEnterSettleRealm, isLocalChain, mode.ui.showMintCta, resolveBottomContent]);

  return {
    isSettlingRealm: stage === "settle",
    bottomContent,
    showBottomContent: mode.ui.showMintCta,
    handleEnterSettleRealm,
    handleExitSettleRealm,
  };
};
