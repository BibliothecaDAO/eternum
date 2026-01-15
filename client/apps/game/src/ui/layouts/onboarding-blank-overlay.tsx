import { OnboardingActions, OnboardingContainer, OnboardingStage } from "@/ui/layouts/onboarding/index";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";

interface OnboardingBlankOverlayProps {
  backgroundImage: string;
  onConnect: () => void;
  onSpectate: () => void;
}

export const OnboardingBlankOverlay = ({ backgroundImage, onConnect, onSpectate }: OnboardingBlankOverlayProps) => {
  const mode = useGameModeConfig();

  return (
    <OnboardingContainer backgroundImage={backgroundImage}>
      <OnboardingStage>
        <OnboardingActions onConnect={onConnect} onSpectate={onSpectate} showMintCta={mode.ui.showMintCta} />
      </OnboardingStage>
    </OnboardingContainer>
  );
};

export default OnboardingBlankOverlay;
