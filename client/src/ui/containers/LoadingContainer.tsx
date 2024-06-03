import useUIStore from "@/hooks/store/useUIStore";
import { useProgress } from "@react-three/drei";
import clsx from "clsx";
import { useMemo } from "react";

export const LoadingContainer = () => {
  const isLoadingScreenEnabled = useUIStore((state) => state.isLoadingScreenEnabled);
  const progress = useProgress((state) => state.progress);

  const isLoading = useMemo(() => {
    return isLoadingScreenEnabled || progress !== 100;
  }, [isLoadingScreenEnabled, progress]);

  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 z-[49] w-full pointer-events-none flex items-center text-white justify-center text-3xl rounded-xl h-full bg-map duration-300 transition-opacity bg-brown",
        isLoading ? "opacity-100" : "opacity-0",
      )}
    >
      <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
    </div>
  );
};
