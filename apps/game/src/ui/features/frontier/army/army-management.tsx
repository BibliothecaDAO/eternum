import { useState } from "react";
import { getBlockTimestamp, multiplyByPrecision } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatExact, RESOURCE_PRECISION } from "@bibliothecadao/types";

import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { canIssueOrders } from "@/utils/can-issue-orders";
import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { Icon } from "@/ui/design-system/icon";
import { AmountInput, HudButton, HudConfirm, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { ARMY_MANAGEMENT } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";

import type { DockArmy } from "../hud/dock-armies";
import { readReinforcePlan } from "./reinforce-plan";

const MODELS = [
  "ExplorerTroops",
  "TileOccupancy",
  "ArmySlot",
  "ArmyProgress",
  "Structure",
  "GameRegistry",
  "SliceRules",
  "SettlementRules",
  "ResourceBalance",
  "ResourceProduction",
  "ResourceRule",
  "ProductionRecipe",
  "BoardRules",
  "RealmKnowledge",
] as const;

/** Reinforce at today's home, or permanently remove this army through the existing command. */
export const ArmyManagement = ({
  army,
  realm,
  onDeleted,
}: {
  army: DockArmy;
  realm: NativeRows["Structure"];
  onDeleted: () => void;
}) => {
  const { setup, account } = useGame();
  const timestamp = useCurrentDefaultTick();
  useNativeRevision(MODELS);
  const ordersAllowed = useUIStore(canIssueOrders);
  const busy = useInFlight("army", army.explorerId) !== undefined;
  const [mode, setMode] = useState<"reinforce" | "delete" | null>(null);
  const [amount, setAmount] = useState(1);
  const plan = readReinforcePlan(setup.store, realm, army.explorerId, amount, timestamp);
  if (!ordersAllowed) return null;

  const reinforce = async () => {
    const signer = account.account;
    if (!signer || busy) return;
    const current = readReinforcePlan(
      setup.store,
      realm,
      army.explorerId,
      amount,
      getBlockTimestamp().currentDefaultTick,
    );
    if (!current || current.reason) return;
    try {
      await sendOnce("army", army.explorerId, { order: "use" }, () =>
        setup.systemCalls.explorer_add({
          signer,
          to_explorer_id: army.explorerId,
          amount: multiplyByPrecision(amount),
          home_direction: current.direction!,
        }),
      );
      setMode(null);
    } catch (error) {
      toast.failed(error, ARMY_MANAGEMENT.reinforceFailed);
    }
  };

  const remove = async () => {
    const signer = account.account;
    if (!signer || busy) return;
    try {
      const sent = await sendOnce("army", army.explorerId, { order: "use" }, () =>
        setup.systemCalls.explorer_delete({ signer, explorer_id: army.explorerId }),
      );
      if (sent) onDeleted();
    } catch (error) {
      toast.failed(error, ARMY_MANAGEMENT.deleteFailed);
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-hud-divider pt-3">
      {mode === null && (
        <div className="flex items-center justify-between gap-2">
          <HudButton kind="secondary" disabled={busy || !plan?.besideHome} onClick={() => setMode("reinforce")}>
            {ARMY_MANAGEMENT.reinforce}
          </HudButton>
          <HudButton kind="quiet" disabled={busy} onClick={() => setMode("delete")}>
            {ARMY_MANAGEMENT.remove}
          </HudButton>
        </div>
      )}
      {mode === null && plan && !plan.besideHome && <HudNotice line={ARMY_MANAGEMENT.homeOnly} />}
      {mode === "reinforce" && (
        <>
          <AmountInput label={ARMY_MANAGEMENT.amount} value={amount} max={plan?.maximum ?? 0} onChange={setAmount} />
          {plan && (
            <span className="text-hud-body tabular-nums" aria-label={ARMY_MANAGEMENT.after}>
              {formatExact(plan.current)} → {formatExact(plan.current + amount)}
            </span>
          )}
          <div className="flex gap-3" aria-label={ARMY_MANAGEMENT.cost}>
            {plan?.costs.map((cost) => (
              <span key={cost.resource} className="flex items-center gap-1 tabular-nums">
                <Icon name={resourceMeaning(cost.resource)} size={20} />
                {formatExact(Number(cost.amount) / RESOURCE_PRECISION)}
              </span>
            ))}
          </div>
          {plan?.reason && <HudNotice tone="warn" line={plan.reason} />}
          <div className="flex justify-end gap-2">
            <HudButton kind="quiet" disabled={busy} onClick={() => setMode(null)}>
              {ARMY_MANAGEMENT.cancel}
            </HudButton>
            <HudButton
              kind="primary"
              disabled={!plan || plan.reason !== null}
              busy={busy ? ARMY_MANAGEMENT.reinforcing : undefined}
              onClick={reinforce}
            >
              {ARMY_MANAGEMENT.reinforce}
            </HudButton>
          </div>
        </>
      )}
      {mode === "delete" && (
        <HudConfirm
          question={ARMY_MANAGEMENT.confirmDelete}
          verb={ARMY_MANAGEMENT.remove}
          tone="bad"
          onConfirm={remove}
          onCancel={() => !busy && setMode(null)}
        >
          {ARMY_MANAGEMENT.loss}
        </HudConfirm>
      )}
    </div>
  );
};
