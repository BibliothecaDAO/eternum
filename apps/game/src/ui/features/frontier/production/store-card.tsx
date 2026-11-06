import { formatAmount, formatRate } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { HUD_TONE, type Tone } from "@/ui/design-system/kit/tone";
import { BUILD, DEPLOY, FULL, MADE_BY, REALM } from "@/ui/design-system/kit/words";

import { FullIn } from "../full-in";
import { SideRank } from "../research/side-rank";
import { type SidePick } from "../research/sides-taken";
import { FRONTIER_STORES, type MadeStore, type SpentAt } from "../stores";

/** One store's line: what it makes an hour (with its row's research, side by side), what it holds against its limit. */
export type StoreLine = {
  kind: MadeStore;
  perHour: number | undefined;
  /** Each side of the research row that makes it, make side first, with the tiers bought on it. */
  sides?: readonly SidePick[];
  held: number | undefined;
  limit: number | undefined;
  tone: Tone;
  /** Seconds until it is full; 0 when full, undefined while the limit or the rate is unknown. */
  fullIn: number | undefined;
  /** No building makes it: Build is the way. */
  noBuilding: boolean;
  /** What makes the rate, one line each, adding up to it: the buildings standing and what each makes, the castle's. */
  makers?: readonly string[];
};

/**
 * One store's card, opened from its ring or its plate (the owner, 22 October: no Production overlay): its word beside
 * its icon with when it is full (in hours, never days), the rate an hour with each side of its research row inline as
 * its mark and rank gem (the owner, 6 November), what makes that rate (how many buildings, what each makes with its
 * research, the castle's labor), and what it holds against its limit. A full store says so and points to where it is
 * spent; a store no building makes offers Build.
 */
export const StoreCard = ({
  line,
  onSpend,
  onBuild,
}: {
  line: StoreLine;
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
}) => {
  const full = line.limit !== undefined && line.held !== undefined && line.held >= line.limit;
  const {
    icon,
    word,
    made: { spentAt },
  } = FRONTIER_STORES[line.kind];
  return (
    <HudPanel label={word} collapsible={false} className="pointer-events-auto" bodyClassName="flex flex-col gap-1.5">
      <span data-store-card={line.kind} className="flex items-center gap-2">
        <Icon name={icon} size={28} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* What the store asks for rides on its word's line, so the rate's line has the card's width for both sides. */}
          <span className="flex items-center justify-between gap-2">
            <span className="text-hud-label text-hud-muted">{word}</span>
            <StoreAsk line={line} full={full} spentAt={spentAt} onSpend={onSpend} onBuild={onBuild} />
          </span>
          <span className={`flex items-center gap-2 whitespace-nowrap tabular-nums ${full ? "text-hud-bad" : ""}`}>
            {full ? formatRate(0) : formatRate(line.perHour === undefined ? undefined : line.perHour / 3600)}
            {line.sides?.map((side) => (
              <SideRank key={side.icon} icon={side.icon} rank={side.picks} markSize={18} />
            ))}
          </span>
        </span>
      </span>
      {line.makers && line.makers.length > 0 && (
        <ul aria-label={MADE_BY} className="flex flex-col text-hud-label tabular-nums text-hud-muted">
          {line.makers.map((maker) => (
            <li key={maker}>{maker}</li>
          ))}
        </ul>
      )}
      {line.limit !== undefined && (
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1">
            <HudMeter
              share={line.held === undefined || line.limit <= 0 ? 0 : line.held / line.limit}
              tone={HUD_TONE[line.tone]}
              label={word}
            />
          </span>
          {/* A full store holds its limit, so it says the one number beside Full. */}
          <span className="whitespace-nowrap text-hud-label tabular-nums">
            {formatAmount(line.held)}
            {!full && ` / ${formatAmount(line.limit)}`}
          </span>
        </span>
      )}
    </HudPanel>
  );
};

/** What a store asks of the player: when it fills, Build for one no building makes, or Full with where it is spent. */
const StoreAsk = ({
  line,
  full,
  spentAt,
  onSpend,
  onBuild,
}: {
  line: StoreLine;
  full: boolean;
  spentAt: SpentAt;
  onSpend: (at: SpentAt) => void;
  onBuild: () => void;
}) => {
  if (full)
    return (
      <span className="flex items-center gap-2">
        <HudChip tone="bad">{FULL}</HudChip>
        <HudButton
          kind="secondary"
          size="sm"
          icon={spentAt === "realm" ? "realm" : undefined}
          onClick={() => onSpend(spentAt)}
        >
          {spentAt === "realm" ? REALM : DEPLOY}
        </HudButton>
      </span>
    );
  if (line.noBuilding)
    return (
      <HudButton kind="secondary" size="sm" onClick={onBuild}>
        {BUILD}
      </HudButton>
    );
  return line.fullIn === undefined ? null : <FullIn seconds={line.fullIn} />;
};
