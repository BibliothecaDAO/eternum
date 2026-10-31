import { formatAmount, formatRate } from "@bibliothecadao/types";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudMeter, HudPanel } from "@/ui/design-system/kit/hud-elements";
import { HUD_TONE, type Tone } from "@/ui/design-system/kit/tone";
import { BUILD, DEPLOY, FULL, MADE_BY, REALM } from "@/ui/design-system/kit/words";

import { FullIn } from "../full-in";
import { FRONTIER_STORES, type MadeStore, type SpentAt } from "../stores";

/** One store's line: what it makes an hour (with the side marks that shape it), what it holds against its limit. */
export type StoreLine = {
  kind: MadeStore;
  perHour: number | undefined;
  sides?: readonly IconMeaning[];
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
 * its icon, the rate an hour with its side marks, what makes that rate (how many buildings, what each makes with its
 * research, the castle's labor), what it holds against its limit, and when it is full, in hours, never days. A full
 * store says so and points to where it is spent; a store no building makes offers Build.
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
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-hud-label text-hud-muted">{word}</span>
          <span className={`flex items-center gap-1 tabular-nums ${full ? "text-hud-bad" : ""}`}>
            {full ? formatRate(0) : formatRate(line.perHour === undefined ? undefined : line.perHour / 3600)}
            {line.sides?.map((side, index) => (
              <Icon key={index} name={side} size={18} />
            ))}
          </span>
        </span>
        {full ? (
          <>
            <HudChip tone="bad">{FULL}</HudChip>
            <HudButton
              kind="secondary"
              size="sm"
              icon={spentAt === "realm" ? "realm" : undefined}
              onClick={() => onSpend(spentAt)}
            >
              {spentAt === "realm" ? REALM : DEPLOY}
            </HudButton>
          </>
        ) : line.noBuilding ? (
          <HudButton kind="secondary" size="sm" onClick={onBuild}>
            {BUILD}
          </HudButton>
        ) : (
          line.fullIn !== undefined && <FullIn seconds={line.fullIn} />
        )}
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
