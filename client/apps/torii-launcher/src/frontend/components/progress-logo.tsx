import EternumLogo from "@public/eternum-new.svg?react";
import { Page, useAppContext } from "../context";

export const ProgressLogo = () => {
  const { progress, page } = useAppContext();

  const clampedProgress = page === Page.Start ? 100 : progress;

  return (
    <div className="flex flex-col items-center w-[126px] h-[105px] justify-center">
      <EternumLogo className="relative w-[84px] h-[69px] fill-white/20" />
      <EternumLogo
        className="absolute w-[84px] h-[69px] fill-white transition-all duration-300 ease-in-out"
        style={{
          clipPath: `inset(${100 - clampedProgress}% 0 0 0)`,
        }}
      />
    </div>
  );
};
