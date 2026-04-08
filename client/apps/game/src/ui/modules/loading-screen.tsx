import { useEffect } from "react";
import { prefetchPlayAssets } from "@/ui/utils/prefetch-play-assets";
import { BootLoaderShell, markBootMilestone, setBootDocumentState } from "@/ui/modules/boot-loader";

interface LoadingScreenProps {
  prefetchPlayAssets?: boolean;
  progress?: number;
  title?: string;
  subtitle?: string;
}

export const LoadingScreen = ({
  prefetchPlayAssets: shouldPrefetch,
  progress,
  title = "Forging the Realm",
  subtitle = "Summoning terrain, armies, and ancient trade routes.",
}: LoadingScreenProps) => {
  useEffect(() => {
    setBootDocumentState("app-loading");
    markBootMilestone("boot_react_loader_visible");

    if (shouldPrefetch) {
      prefetchPlayAssets();
    }
  }, [shouldPrefetch]);

  return (
    <BootLoaderShell
      mode={typeof progress === "number" && progress > 0 ? "determinate" : "indeterminate"}
      progress={progress}
      title={title}
      subtitle={subtitle}
      caption="Initializing"
    />
  );
};
