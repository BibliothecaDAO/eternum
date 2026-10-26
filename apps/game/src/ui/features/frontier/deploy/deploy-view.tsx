import type { IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCost,
  HudMeter,
  HudNotice,
  HudPortrait,
  HudSheet,
  HudTroopAmount,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import {
  BUILD,
  DEPLOY,
  DEPLOYING,
  LEAVES_NO_WHEAT,
  NO_OPEN_TILE,
  NO_TROOPS_AT_HOME,
  STAMINA,
  TROOPS,
} from "@/ui/design-system/kit/words";

import type { SlotStart } from "./deploy-plan";
import { slotStartLine } from "./slot-start";

/**
 * Deploy, from its props: the two choices a deploy makes and its one verb. How many troops go (the count typed, +500
 * and Max beside it, out of how many can, a slider under them), the stamina the army starts on (its slot's bar), and
 * onto which tile beside the realm: picked on the map itself, where the order's tile is marked among the realm's open
 * ones (owner, 26 October 2026: "we dont need to show another map in the deploy panel"), so the sheet only says so.
 * Deploy stands in the foot with its wheat price and how far the wheat left lets the army march: the trade the count
 * makes. With no troops at home, Build is the step.
 */
export const DeployView = ({
  art,
  troopsAtHome,
  count,
  amount,
  onCount,
  start,
  wheatCost,
  march,
  tile,
  canDeploy,
  sending,
  onDeploy,
  wheatShort,
  onBuild,
  onClose,
}: {
  art: IconMeaning | undefined;
  troopsAtHome: number | undefined;
  count: number | undefined;
  /** The most that can go, and the troops it is counted from: more than the most reads "that fit". */
  amount: { most: number; held: number };
  onCount: (count: number) => void;
  /** The slot the army fills and the bar it starts on there; none while every slot holds an army or it is unknown. */
  start: SlotStart | undefined;
  wheatCost: number | undefined;
  /** The tiles the wheat left at home lets the army march; unknown is undefined. */
  march: number | undefined;
  /** Whether the realm has an open tile to step out on; unknown while its plan or ring is. */
  tile: "open" | "none" | undefined;
  canDeploy: boolean;
  sending: boolean;
  onDeploy: () => void;
  /** Not even one troop's wheat: held against one troop's price, and the farms' wait. */
  wheatShort: { held: number; need: number; wait: number | undefined } | undefined;
  onBuild: () => void;
  onClose: () => void;
}) => (
  <HudSheet label={DEPLOY} onClose={onClose}>
    <div className="flex items-center gap-2">
      {art && <HudPortrait icon={art} label={TROOPS} />}
      <HudTroopAmount
        name={TROOPS}
        value={count ?? 0}
        most={amount.most}
        held={amount.held}
        disabled={amount.most === 0}
        onChange={onCount}
      />
    </div>
    {start && troopsAtHome !== 0 && <SlotStartReading start={start} />}
    {troopsAtHome === 0 ? (
      <>
        <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />
        <HudButton kind="primary" onClick={onBuild}>
          {BUILD}
        </HudButton>
      </>
    ) : (
      tile === "none" && <HudNotice tone="warn" line={NO_OPEN_TILE} />
    )}
    {wheatShort && <HudNotice tone="warn" line={shortfallLine({ kind: "short", of: "wheat", ...wheatShort })} />}
    {canDeploy && wheatCost !== undefined && (
      <HudWindowFoot note={<DeployPrice wheatCost={wheatCost} march={march} />}>
        <HudButton
          kind="primary"
          icon="military"
          disabled={!count}
          busy={sending ? DEPLOYING : undefined}
          onClick={onDeploy}
        >
          {DEPLOY}
        </HudButton>
      </HudWindowFoot>
    )}
  </HudSheet>
);

/** The stamina the new army starts on: its slot's bar, as its card will show it once out. */
const SlotStartReading = ({ start }: { start: SlotStart }) => {
  const line = slotStartLine(start);
  if (!line || !start.start) return null;
  return (
    <section aria-label={line} className="flex flex-col gap-1">
      <span>{line}</span>
      <HudMeter amount={start.start} tone="good" label={STAMINA} />
    </section>
  );
};

/** The wheat Deploy takes, and under it a warning when the wheat left lets the army march nowhere. */
const DeployPrice = ({ wheatCost, march }: { wheatCost: number; march: number | undefined }) => (
  <span className="flex flex-col items-start">
    <HudCost line={costLine([{ of: "wheat", amount: wheatCost }])} />
    {march === 0 && <span className="text-hud-warn">{LEAVES_NO_WHEAT}</span>}
  </span>
);
