import { BlitzOnboarding, SettleRealm, StepOne } from "@/ui/features/progression";

import { OnboardingContainer } from "./components/onboarding-container";
import { OnboardingStage } from "./components/onboarding-stage";
import { useOnboardingState } from "./use-onboarding-state";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

interface OnboardingProps {
  backgroundImage: string;
}

export const Onboarding = ({ backgroundImage }: OnboardingProps) => {
  const { isSettlingRealm, bottomContent, showBottomContent, handleExitSettleRealm } = useOnboardingState();
  const mode = useGameModeConfig();

  const onboardingVariants = {
    blitz: BlitzOnboarding,
    standard: StepOne,
  };
  const OnboardingVariant = onboardingVariants[mode.ui.onboardingVariant];
  const stageContent = isSettlingRealm ? <SettleRealm onPrevious={handleExitSettleRealm} /> : <OnboardingVariant />;

  const stepProps = isSettlingRealm
    ? { bottomChildren: bottomContent, isSettleRealm: true }
    : { bottomChildren: showBottomContent ? bottomContent : undefined };

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <OnboardingStage stepProps={stepProps}>{stageContent}</OnboardingStage>
    </OnboardingContainer>
  );
};
