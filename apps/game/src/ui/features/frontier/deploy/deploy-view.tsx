import type { IconMeaning } from "@/ui/design-system/icon";
import {
  HudButton,
  HudCost,
  HudNotice,
  HudPortrait,
  HudSheet,
  HudTroopAmount,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import { BUILD, DEPLOY, DEPLOYING, marchLine, NO_TROOPS_AT_HOME, TROOPS } from "@/ui/design-system/kit/words";
import {
  type DeployTile,
  RealmHexDeployMap,
} from "@/ui/features/military/components/unified-army-creation-modal/realm-hex-deploy-map";
import type { Direction } from "@bibliothecadao/types";

/**
 * Deploy, from its props: the two choices a deploy makes and its one verb. How many troops go (the count typed, +500
 * and Max beside it, out of how many can), onto which tile beside the realm (the map selector), then Deploy in the foot
 * with its wheat price and how far the wheat left lets the army march: the trade the count makes. With no troops at
 * home, Build is the step.
 */
export const DeployView = ({
  art,
  troopsAtHome,
  count,
  amount,
  onCount,
  wheatCost,
  march,
  ring,
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
  wheatCost: number | undefined;
  /** The tiles the wheat left at home lets the army march; unknown is undefined. */
  march: number | undefined;
  ring:
    | {
        center: { col: number; row: number };
        tiles: readonly DeployTile[];
        chosen: Direction | null;
        onPick: (direction: Direction) => void;
      }
    | undefined;
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
    {troopsAtHome === 0 ? (
      <>
        <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />
        <HudButton kind="primary" onClick={onBuild}>
          {BUILD}
        </HudButton>
      </>
    ) : (
      ring && (
        <RealmHexDeployMap
          centerCol={ring.center.col}
          centerRow={ring.center.row}
          ring={ring.tiles}
          selectedDirection={ring.chosen}
          onSelect={ring.onPick}
        />
      )
    )}
    {wheatShort && <HudNotice tone="warn" line={shortfallLine({ kind: "short", of: "wheat", ...wheatShort })} />}
    {canDeploy && wheatCost !== undefined && (
      <HudWindowFoot note={<DeployPrice wheatCost={wheatCost} march={march} />}>
        <HudButton kind="primary" icon="military" busy={sending ? DEPLOYING : undefined} onClick={onDeploy}>
          {DEPLOY}
        </HudButton>
      </HudWindowFoot>
    )}
  </HudSheet>
);

/** The wheat Deploy takes, and under it how far the wheat left lets the army march (none reads as a warning). */
const DeployPrice = ({ wheatCost, march }: { wheatCost: number; march: number | undefined }) => (
  <span className="flex flex-col items-start">
    <HudCost line={costLine([{ of: "wheat", amount: wheatCost }])} />
    {march !== undefined && <span className={march === 0 ? "text-hud-warn" : undefined}>{marchLine(march)}</span>}
  </span>
);
