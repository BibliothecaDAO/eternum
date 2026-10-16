import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import Button from "../design-system/atoms/button";

export const ConstructionGate = () => {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4 text-center text-gold">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/videos/01.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center justify-center rounded-xl border border-gold/30 bg-[#1a1410]/95 p-6 sm:max-w-xl md:max-w-2xl md:p-10">
        <EternumWordsLogo className="mx-auto w-28 fill-current stroke-current sm:w-40 lg:w-48" />

        <p className="my-6 text-lg leading-snug sm:text-xl md:text-2xl">
          Blitz is being crafted, and will be available soon...
        </p>

        <div className="mt-4 flex w-full flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          <a
            href="https://discord.gg/uQnjZhZPfu"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-bronze flex items-center px-4 py-2"
          >
            <SemanticIcon name="discord" className="mr-2 h-5 w-5" />
            Discord
          </a>

          <a
            href="https://x.com/realmsgg"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-bronze flex items-center px-4 py-2"
          >
            <SemanticIcon name="twitter" className="mr-2 h-5 w-5" />
            Twitter
          </a>

          <Button
            variant="gold"
            className="w-full sm:w-auto"
            onClick={() => window.open("https://empire.realms.world/trade", "_blank")}
          >
            Buy a Season Pass
          </Button>

          <Button
            variant="gold"
            className="w-full sm:w-auto"
            onClick={() => window.open("https://docs.realms.world/", "_blank")}
          >
            Docs
          </Button>
        </div>
      </div>
    </div>
  );
};
