import { prefetchPlayAssets } from "@/ui/utils/prefetch-play-assets";
import { useEffect } from "react";
import { OnboardingCountdownOverlay, OnboardingLoadingOverlay } from "@/ui/layouts/onboarding/index";
import "../../index.css";

interface LoadingScreenProps {
  backgroundImage: string;
  progress?: number;
  prefetchPlayAssets?: boolean;
}

export const LoadingScreen = ({
  backgroundImage,
  progress,
  prefetchPlayAssets: shouldPrefetch,
}: LoadingScreenProps) => {
  useEffect(() => {
    if (shouldPrefetch) {
      prefetchPlayAssets();
    }
  }, [shouldPrefetch]);

  return <OnboardingLoadingOverlay backgroundImage={backgroundImage} progress={progress} />;
};

function CountdownTimer({ backgroundImage }: { backgroundImage: string }) {
  return <OnboardingCountdownOverlay backgroundImage={backgroundImage} />;
}
