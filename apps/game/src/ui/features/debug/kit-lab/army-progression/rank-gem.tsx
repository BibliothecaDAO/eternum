import { HudTier } from "@/ui/design-system/kit/hud-elements";
import type { Tier } from "@/ui/design-system/kit/words";

/** Lab only, round 4: a rank from 0 (no gem: an empty socket) to Legendary V. */
export const RankGem = ({ rank }: { rank: number }) =>
  rank === 0 ? (
    <span
      role="img"
      aria-label="No rank"
      className="relative inline-flex h-[22px] w-[26px] flex-none bg-hud-line-strong"
      style={{ clipPath: HEX }}
    >
      <span className="absolute inset-[2px] bg-hud-well" style={{ clipPath: HEX }} />
    </span>
  ) : (
    <HudTier tier={rank as Tier} />
  );

/** A rank's next step, from its gem (or empty socket) to the next one's. */
export const RankStep = ({ from, to }: { from: number; to: number }) => (
  <span className="ui-tier-step">
    <RankGem rank={from} />
    <span aria-hidden>→</span>
    <RankGem rank={to} />
  </span>
);

const HEX = "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";
