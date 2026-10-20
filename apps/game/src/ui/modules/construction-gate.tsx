import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";
import { communityPlace } from "@/shell/community";
import { HudButton, HudPanel } from "@/ui/design-system/kit/hud-elements";

const open = (url: string) => () => window.open(url, "_blank", "noopener,noreferrer");

/** While the game is closed for construction: the word that it is coming, and where to follow it. */
export const ConstructionGate = () => (
  <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4 text-center">
    <video
      className="absolute inset-0 h-full w-full object-cover"
      src="/videos/01.mp4"
      autoPlay
      loop
      muted
      playsInline
    />
    <HudPanel collapsible={false} className="relative w-full max-w-xl">
      <div className="flex flex-col items-center gap-6 p-4 text-hud-gold">
        <EternumWordsLogo className="mx-auto w-40 fill-current stroke-current" />
        <p className="text-hud-display text-hud-ink">Blitz is being crafted, and will be available soon…</p>
        <div className="flex flex-wrap justify-center gap-3">
          <HudButton kind="primary" onClick={open("https://empire.realms.world/trade")}>
            Buy a Season Pass
          </HudButton>
          <HudButton kind="secondary" icon="discord" onClick={open(communityPlace("Discord").href)}>
            Discord
          </HudButton>
          <HudButton kind="secondary" icon="twitter" onClick={open(communityPlace("X").href)}>
            Twitter
          </HudButton>
          <HudButton kind="secondary" onClick={open("https://docs.realms.world/")}>
            Docs
          </HudButton>
        </div>
      </div>
    </HudPanel>
  </div>
);
