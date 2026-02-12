import { prefetchPlayAssets } from "@/ui/utils/prefetch-play-assets";
import { useEffect } from "react";
import { LoadingOroborus } from "@/ui/modules/loading-oroborus";

interface LoadingScreenProps {
  prefetchPlayAssets?: boolean;
}

export const LoadingScreen = ({ prefetchPlayAssets: shouldPrefetch }: LoadingScreenProps) => {
  useEffect(() => {
    if (shouldPrefetch) {
      prefetchPlayAssets();
    }
  }, [shouldPrefetch]);

  return <LoadingOroborus loading />;
};
