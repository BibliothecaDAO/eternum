import { formatAmount, REALM_LEVELS } from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { costLine, type Price } from "@/ui/design-system/kit/price-faces";
import { HudButton, HudCard, HudChip, HudCost, HudSheet } from "@/ui/design-system/kit/hud-elements";
import type { Refusal } from "@/ui/design-system/kit/refusal";
import { CASTLE, TROOPS, UPGRADE, UPGRADING } from "@/ui/design-system/kit/words";

import { RefusedVerb } from "../refused-verb";
import { type Figure, Figures } from "./type-upgrade-sheet";

/** The castle at one level: its art and level, the plots it opens, its army slots, each store's limit, the deploy cap. */
export type CastleSide = {
  level: number;
  art: IconMeaning;
  plots: number;
  slots: number;
  /** What the castle stores of each store at this level, before the Granary and Storeroom; unknown is undefined. */
  limit: number | undefined;
  deployCap: number;
};

/**
 * The castle's sheet (wireframe 02): what the castle makes and holds now, the castle now and at its next level side by side, what the next level brings lit,
 * and Upgrade with its labor cost under it. When the realm cannot pay, Upgrade stays, dimmed, with its cost; the line
 * under it says what it needs against what is held and the exact wait; the map is offered where a reveal pays labor.
 * At the last level there is no next side and no verb.
 */
export const CastleView = ({
  now,
  next,
  makes,
  prices,
  refusal,
  sending,
  onUpgrade,
  onClose,
}: {
  now: CastleSide;
  next: CastleSide | null;
  /** What the castle itself makes and holds now: its own labor an hour, and the labor in its store. */
  makes: readonly Figure[];
  prices: Price[];
  refusal: Refusal | undefined;
  sending: boolean;
  onUpgrade: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={CASTLE} onClose={onClose}>
    {makes.length > 0 && <Figures figures={makes} />}
    <div className="flex items-center gap-2">
      <Side side={now} />
      {next && (
        <>
          <span aria-hidden className="text-hud-title text-hud-accent">
            →
          </span>
          <Side side={next} lit />
        </>
      )}
    </div>
    {next &&
      (refusal ? (
        <RefusedVerb word={UPGRADE} prices={prices} refusal={refusal} />
      ) : (
        <>
          <HudButton kind="primary" busy={sending ? UPGRADING : undefined} onClick={onUpgrade}>
            {UPGRADE}
          </HudButton>
          <HudCost line={costLine(prices)} />
        </>
      ))}
  </HudSheet>
);

/** The castle at a level, its picture over what it opens and holds; the next level lit. */
const Side = ({ side, lit = false }: { side: CastleSide; lit?: boolean }) => (
  <div className="flex-1">
    <HudCard
      title={REALM_LEVELS[side.level]}
      picture={<Icon name={side.art} alt="" size={56} />}
      selected={lit}
      detail={
        <span className="flex flex-col items-center gap-1">
          <HudChip icons={["hexagon"]} label="plots">
            {formatAmount(side.plots)}
          </HudChip>
          <HudChip icons={["army-capacity"]} label="army slots">
            {formatAmount(side.slots)}
          </HudChip>
          {side.limit !== undefined && (
            <HudChip icons={["resources"]} label="limit">
              {formatAmount(side.limit)}
            </HudChip>
          )}
          <HudChip icons={["troops"]} label={TROOPS}>
            {formatAmount(side.deployCap)}
          </HudChip>
        </span>
      }
    />
  </div>
);
