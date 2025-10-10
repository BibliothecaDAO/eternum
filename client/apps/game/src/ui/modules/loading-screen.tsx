import { OnboardingCountdownOverlay, OnboardingLoadingOverlay } from "@/ui/layouts/onboarding/index";
import "../../index.css";

interface LoadingScreenProps {
  backgroundImage: string;
  progress?: number;
}

export const LoadingScreen = ({ backgroundImage, progress }: LoadingScreenProps) => {
  return <OnboardingLoadingOverlay backgroundImage={backgroundImage} progress={progress} />;
};

export function CountdownTimer({ backgroundImage }: { backgroundImage: string }) {
  return <OnboardingCountdownOverlay backgroundImage={backgroundImage} />;
}
