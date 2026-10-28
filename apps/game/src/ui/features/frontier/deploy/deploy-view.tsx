import type { IconMeaning } from "@/ui/design-system/icon";
import { formatWait } from "@bibliothecadao/types";
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
import {
  BUILD,
  DEPLOY,
  DEPLOYING,
  NO_OPEN_TILE,
  NO_TROOPS_AT_HOME,
  noTroopsUntil,
  TROOPS,
} from "@/ui/design-system/kit/words";

import { StaminaReading } from "../hud/army-token";
import type { SlotStart } from "./deploy-plan";

/**
 * Deploy, from its props: the controls, the numbers and the action, with no line explaining them (owner, 26 October
 * 2026: "good UI/UX doesnt need subtext"). How many troops go (the count, +500, Max, out of how many can, a slider), the
 * stamina bar the army starts on, and Deploy with its wheat price. The tile is picked on the map itself, where the
 * order's tile is marked among the realm's open ones. A notice shows only where Deploy cannot: no troops at home (when
 * the next is home, or Build with the Barracks' mark while nothing makes them), no open tile, or not one troop's wheat.
 */
export const DeployView = ({
  art,
  troopsAtHome,
  count,
  amount,
  onCount,
  start,
  slots,
  troopsWait,
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
  slots: { allowed: number; open: SlotStart[] | undefined; onPick: (slot: number) => void };
  /** Seconds until the realm's next troop is home; none while nothing makes troops. */
  troopsWait: number | undefined;
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
    <div role="group" aria-label="Army slots" className="flex flex-wrap gap-2">
      {Array.from({ length: slots.allowed }, (_, slot) => {
        const available = slots.open?.find((entry) => entry.slot === slot);
        return (
          <button
            key={slot}
            type="button"
            aria-label={`Army ${slot + 1}`}
            aria-pressed={start?.slot === slot}
            disabled={!available || sending}
            onClick={() => slots.onPick(slot)}
            className="flex flex-col gap-1 rounded border border-hud-line p-2 text-hud-ink aria-pressed:border-hud-line-strong aria-pressed:bg-hud-surface disabled:opacity-50"
          >
            <span>Army {slot + 1}</span>
            <span>
              {available?.start
                ? `${available.start.current}/${available.start.max} stamina`
                : available
                  ? "No troops"
                  : slots.open
                    ? "Deployed"
                    : "Loading…"}
            </span>
          </button>
        );
      })}
    </div>
    {start?.start && troopsAtHome !== 0 && <StaminaReading stamina={start.start} />}
    {troopsAtHome === 0 ? (
      troopsWait === undefined ? (
        <>
          <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />
          <HudButton kind="primary" icon="barracks" onClick={onBuild}>
            {BUILD}
          </HudButton>
        </>
      ) : (
        <HudNotice tone="warn" line={noTroopsUntil(formatWait(troopsWait))} />
      )
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
