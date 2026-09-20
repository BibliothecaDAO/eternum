import { Discord } from "@/ui/design-system/atoms/game-icons";
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
            <Discord className="mr-2 h-5 w-5" />
            Discord
          </a>

          <a
            href="https://x.com/realmsgg"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-bronze flex items-center px-4 py-2"
          >
            <svg className="mr-2 h-5 w-5 fill-gold" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
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
