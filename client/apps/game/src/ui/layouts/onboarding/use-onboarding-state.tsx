import { ReactNode, useCallback, useMemo, useState } from "react";

import { getIsBlitz } from "@bibliothecadao/eternum";

import { LocalStepOne } from "@/ui/features/progression";

import { env } from "../../../../env";
import { SeasonPassButton } from "./components/season-pass-button";

type OnboardingStage = "intro" | "settle";

export interface BottomContentContext {
  isBlitz: boolean;
  isLocalChain: boolean;
  handleEnterSettleRealm: () => void;
}

export interface UseOnboardingStateOptions {
  resolveBottomContent?: (context: BottomContentContext) => ReactNode | undefined;
}

interface UseOnboardingStateReturn {
  isSettlingRealm: boolean;
  isBlitz: boolean;
  bottomContent?: ReactNode;
  handleEnterSettleRealm: () => void;
  handleExitSettleRealm: () => void;
}

export const useOnboardingState = ({
  resolveBottomContent,
}: UseOnboardingStateOptions = {}): UseOnboardingStateReturn => {
  const [stage, setStage] = useState<OnboardingStage>("intro");
  const isBlitz = getIsBlitz();
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
        isBlitz,
        isLocalChain,
        handleEnterSettleRealm,
      });
    }

    if (isBlitz) {
      return undefined;
    }

    if (isLocalChain) {
      return <LocalStepOne />;
    }

    return <SeasonPassButton onSettleRealm={handleEnterSettleRealm} />;
  }, [handleEnterSettleRealm, isBlitz, isLocalChain, resolveBottomContent]);

  return {
    isSettlingRealm: stage === "settle",
    isBlitz,
    bottomContent,
    handleEnterSettleRealm,
    handleExitSettleRealm,
  };
};
