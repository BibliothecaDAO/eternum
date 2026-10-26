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
import { BUILD, DEPLOY, DEPLOYING, NO_OPEN_TILE, NO_TROOPS_AT_HOME, TROOPS } from "@/ui/design-system/kit/words";

import { StaminaReading } from "../hud/army-token";
import type { SlotStart } from "./deploy-plan";

/**
 * Deploy, from its props: the controls, the numbers and the action, with no line explaining them (owner, 26 October
 * 2026: "good UI/UX doesnt need subtext"). How many troops go (the count, +500, Max, out of how many can, a slider), the
 * stamina bar the army starts on, and Deploy with its wheat price. The tile is picked on the map itself, where the
 * order's tile is marked among the realm's open ones. A notice shows only where Deploy cannot: no troops at home (Build
 * is the step), no open tile, or not one troop's wheat.
 */
export const DeployView = ({
  art,
  troopsAtHome,
  count,
  amount,
  onCount,
  start,
  wheatCost,
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
    {start?.start && troopsAtHome !== 0 && <StaminaReading stamina={start.start} />}
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
      <HudWindowFoot note={<HudCost line={costLine([{ of: "wheat", amount: wheatCost }])} />}>
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
