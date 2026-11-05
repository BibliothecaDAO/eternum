import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import {
  HudButton,
  HudChip,
  HudCost,
  HudNotice,
  HudSheet,
  HudTroopAmount,
  HudWindowFoot,
} from "@/ui/design-system/kit/hud-elements";
import { costLine } from "@/ui/design-system/kit/price-faces";
import { shortfallLine } from "@/ui/design-system/kit/reasons";
import { NO_TROOPS_AT_HOME, REINFORCE, TRANSFER_TROOPS, TROOPS, wheatForOnly } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { multiplyByPrecision } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, formatShortChange } from "@bibliothecadao/types";
import { useState } from "react";

import { wheatStopsAt } from "../deploy/deploy-plan";
import { type DockArmy, useDockArmies } from "../hud/dock-armies";
import { homeDirectionOf, readReinforcePlan, type ReinforcePlan, reinforceRange } from "./reinforce-plan";

const REINFORCE_MODELS = [
  "ExplorerTroops",
  "TileOccupancy",
  "Structure",
  "ResourceBalance",
  "ResourceProduction",
  "RealmKnowledge",
] as const;

/**
 * The reinforcement the map has selected: the player's realm acting on the tile of one of its armies standing beside
 * it, as Blitz reinforces (the realm selected, the army right-clicked or, on a phone, held). Null for anything else, an
 * army that has left the realm's side, and a viewer, who orders no army.
 */
export const useSelectedReinforcement = (realm: NativeRows["Structure"] | null): DockArmy | null => {
  const { setup } = useGame();
  const armies = useDockArmies(realm);
  const selection = useUIStore((state) => state.mapSelection);
  const ordersAllowed = useUIStore(canIssueOrders);
  if (!realm || !ordersAllowed || selection?.kind !== "structure" || !selection.tile) return null;
  if (Number(selection.entityId) !== Number(realm.entity_id)) return null;
  const tile = selection.tile;
  const standsThere = (army: DockArmy) => {
    const at = setup.store.entityOccupancy(realm.game_id, army.explorerId);
    return at !== undefined && !at.alt && at.col === tile.col && at.row === tile.row;
  };
  return (
    armies.find((army) => standsThere(army) && homeDirectionOf(setup.store, realm, army.explorerId) !== null) ?? null
  );
};

/**
 * Troops from the realm's stock into its army beside it (owner, 4 November 2026: "can we just do it like in blitz ?
 * right click from the realm to the army opens the reinforcement"). The count is Deploy's control, the troop's painting,
 * +500, Max and a slider, opening at none; under it the army's troops before and after, and Reinforce with its wheat
 * price. A notice shows only where nothing can go (no such troops at home, the army full) or where the wheat stops the
 * count at the most. The contract adds troops of the army's own kind, so the stock is that kind's alone.
 */
export const ReinforceSheet = ({
  realm,
  army,
  onClose,
}: {
  realm: NativeRows["Structure"];
  army: DockArmy;
  onClose: () => void;
}) => {
  const { setup, account } = useGame();
  const defaultTick = useCurrentDefaultTick();
  useNativeRevision(REINFORCE_MODELS);
  const plan = readReinforcePlan(setup.store, realm, army.explorerId, defaultTick);
  const range = plan ? reinforceRange(plan) : { troopsMax: 0, wheatMax: 0, max: 0 };
  const [count, setCount] = useState<number | "max">(0);
  const shown = count === "max" ? range.max : Math.min(count, range.max);
  const wheatStop = wheatStopsAt(range, shown);
  const sending = useInFlight("army", army.explorerId) !== undefined;

  /**
   * The sheet stays until the order settles, its button carrying the wait; a refusal says why. The HUD then hands the
   * panel to the army while this pick still stands (useOrderSettledReturnsToTheArmy), and leaves a newer pick alone.
   */
  const reinforce = async () => {
    const signer = account.account;
    // Where the army stands is read again as it is sent: one that has moved off the realm's side sends nothing.
    const home_direction = homeDirectionOf(setup.store, realm, army.explorerId);
    if (!signer || home_direction === null || shown <= 0) return;
    try {
      await sendOnce("army", army.explorerId, { order: "use" }, () =>
        setup.systemCalls.explorer_add({
          signer,
          to_explorer_id: army.explorerId,
          amount: multiplyByPrecision(shown),
          home_direction,
        }),
      );
    } catch (error) {
      toast.failed(error, REINFORCE.failed);
    }
  };

  return (
    <HudSheet label={REINFORCE.title(army.label)} onClose={onClose}>
      <HudTroopAmount
        name={TROOPS}
        art={army.art}
        value={shown}
        most={range.max}
        held={range.wheatMax < range.troopsMax ? range.max : (plan?.stock ?? 0)}
        disabled={range.max === 0 || sending}
        onChange={(next) => setCount(range.max > 0 && next >= range.max ? "max" : next)}
      />
      {plan && (
        <div className="flex justify-center">
          <HudChip icons={["troops"]} label={TROOPS}>
            {formatShortChange(plan.current, plan.current + shown)}
          </HudChip>
        </div>
      )}
      {plan && <ReinforceLimit plan={plan} wheatStop={wheatStop} />}
      {plan && range.max > 0 && (
        <HudWindowFoot note={<HudCost line={costLine([{ of: "wheat", amount: plan.raise.wheatFor(shown) }])} />}>
          <HudButton
            kind="primary"
            icon="military"
            disabled={shown === 0}
            busy={sending ? REINFORCE.sending : undefined}
            onClick={reinforce}
          >
            {REINFORCE.verb}
          </HudButton>
        </HudWindowFoot>
      )}
    </HudSheet>
  );
};

/** Why the count stops where it does: no such troops at home, the army at its cap, or the wheat at the most. */
const ReinforceLimit = ({ plan, wheatStop }: { plan: ReinforcePlan; wheatStop: ReturnType<typeof wheatStopsAt> }) => {
  if (plan.current >= plan.cap) return <HudNotice tone="warn" line={TRANSFER_TROOPS.cap(plan.cap)} />;
  if (plan.stock === 0) return <HudNotice tone="warn" line={NO_TROOPS_AT_HOME} />;
  if (!wheatStop) return null;
  const line =
    wheatStop.troops === 0
      ? shortfallLine({
          kind: "short",
          of: "wheat",
          held: plan.raise.wheat,
          need: plan.raise.wheatFor(1),
          wait: undefined,
        })
      : wheatForOnly(formatExact(wheatStop.troops), formatExact(wheatStop.of));
  return <HudNotice tone="bad" icon="wheat" line={line} />;
};
