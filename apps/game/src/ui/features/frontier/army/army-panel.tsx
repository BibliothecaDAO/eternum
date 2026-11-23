import { DeepDrain, EtherealMark } from "../hud/army-token";
import { formatExact, formatShort } from "@bibliothecadao/types";
import { Icon } from "@/ui/design-system/icon";
import { HudChip, HudPortrait, HudStamina } from "@/ui/design-system/kit/hud-elements";
import { ARMY_DETAIL, TROOPS } from "@/ui/design-system/kit/words";
import type { ReactNode } from "react";
import { FullIn } from "../full-in";
import type { ArmyView } from "./army-detail";

export const ArmyDetail = ({ army, refill }: { army: ArmyView; refill?: ReactNode }) => (
  <div data-army-step="stats" className="flex flex-col gap-3 pt-1">
    <div className="flex items-center gap-3">
      <span className="relative shrink-0">
        <HudPortrait icon={army.art} label={TROOPS} />
        <EtherealMark layer={army.ethereal} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center gap-2">
          <StatusChips army={army} />
          {refill && <span className="ml-auto flex">{refill}</span>}
        </span>
        <StaminaLine stamina={army.stamina} secondsToFull={army.secondsToFull} />
        {army.drain && <DeepDrain drain={army.drain} words />}
      </div>
    </div>
  </div>
);

/** Over the stamina line: the army's troops, and what each tile explored sends home (none where reveals pay none). */
const StatusChips = ({ army }: { army: ArmyView }) => (
  <span className="flex flex-wrap items-center gap-1.5">
    <HudChip icons={["troops"]} label={TROOPS}>
      {formatShort(army.troops)}
    </HudChip>
    {army.revealYield !== null && (
      <HudChip icons={["essence", "labor"]} label={ARMY_DETAIL.revealPaysLabel}>
        {army.revealYield === undefined ? "—" : ARMY_DETAIL.revealPays(formatShort(army.revealYield))}
      </HudChip>
    )}
  </span>
);

/**
 * The stamina on one line (the owner's layout A, 27 October): "96/170", the bar in a segment per explore, and when it is
 * full again.
 */
const StaminaLine = ({ stamina, secondsToFull }: Pick<ArmyView, "stamina" | "secondsToFull">) => (
  <span data-stamina-line className="flex items-center gap-2">
    <span className="flex items-center gap-0.5 whitespace-nowrap text-hud-label tabular-nums text-hud-ink">
      <Icon name="stamina" size={14} />
      {`${formatExact(stamina.current)}/${formatExact(stamina.max)}`}
    </span>
    <span className="min-w-0 flex-1">
      <HudStamina stamina={stamina} />
    </span>
    {secondsToFull !== undefined && secondsToFull > 0 && <FullIn seconds={secondsToFull} />}
  </span>
);
