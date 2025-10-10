import { OnboardingActions, OnboardingContainer, OnboardingStage } from "@/ui/layouts/onboarding/index";
import { getIsBlitz } from "@bibliothecadao/eternum";

interface OnboardingBlankOverlayProps {
  backgroundImage: string;
  onConnect: () => void;
  onSpectate: () => void;
}

export const OnboardingBlankOverlay = ({ backgroundImage, onConnect, onSpectate }: OnboardingBlankOverlayProps) => {
  const isBlitz = getIsBlitz();

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <OnboardingStage>
        <OnboardingActions onConnect={onConnect} onSpectate={onSpectate} showMintCta={!isBlitz} />
      </OnboardingStage>
    </OnboardingContainer>
  );
};

export default OnboardingBlankOverlay;
