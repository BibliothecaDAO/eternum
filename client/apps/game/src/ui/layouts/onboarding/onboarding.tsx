import { BlitzOnboarding, SettleRealm, StepOne } from "@/ui/features/progression";

import { OnboardingContainer } from "./components/onboarding-container";
import { OnboardingStage } from "./components/onboarding-stage";
import { useOnboardingState } from "./use-onboarding-state";

interface OnboardingProps {
  backgroundImage: string;
}

export const Onboarding = ({ backgroundImage }: OnboardingProps) => {
  const { isSettlingRealm, isBlitz, bottomContent, handleExitSettleRealm } = useOnboardingState();

  const stageContent = isSettlingRealm ? (
    <SettleRealm onPrevious={handleExitSettleRealm} />
  ) : isBlitz ? (
    <BlitzOnboarding />
  ) : (
    <StepOne />
  );

  const stepProps = isSettlingRealm
    ? { bottomChildren: bottomContent, isSettleRealm: true }
    : { bottomChildren: isBlitz ? undefined : bottomContent };

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <OnboardingStage stepProps={stepProps}>{stageContent}</OnboardingStage>
    </OnboardingContainer>
  );
};
