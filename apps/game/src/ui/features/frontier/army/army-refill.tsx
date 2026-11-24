import { useState } from "react";
import type { Account } from "starknet";
import { DEEP_DEPTH } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import { REFILL_FAILED } from "@/ui/design-system/kit/words";

import type { DockArmy } from "../hud/dock-armies";
import { useFragmentsHeld } from "../value/fragments";
import { fragmentsToFill, RefillButton, RefillConfirm, RefillPrice } from "./refill";

export const sellsStamina = (army: Pick<DockArmy, "stamina" | "ethereal">, held: number | null): boolean =>
  held !== null && army.stamina !== undefined && army.ethereal !== DEEP_DEPTH && fragmentsToFill(army.stamina) > 0;

export const ArmyRefill = ({ army, look }: { army: DockArmy; look: "price" | "button" }) => {
  const { setup, account } = useGame();
  const held = useFragmentsHeld();
  const sending = useInFlight("refill", army.explorerId) !== undefined;
  const [confirming, setConfirming] = useState(false);
  if (!army.stamina || held === null || !sellsStamina(army, held)) return null;
  const stamina = army.stamina;
  const open = () => setConfirming(true);
  const buy = (fragments: number) =>
    sendOnce("refill", army.explorerId, true, () =>
      setup.systemCalls.buy_stamina({
        signer: account.account as unknown as Account,
        explorerId: army.explorerId,
        fragments,
      }),
    )
      .then(() => setConfirming(false))
      .catch((error: unknown) => toast.failed(error, REFILL_FAILED));
  return (
    <>
      {look === "price" && (
        <RefillPrice price={fragmentsToFill(stamina)} held={held} refilling={sending} onRefill={open} />
      )}
      {look === "button" && <RefillButton held={held} refilling={sending} onRefill={open} />}
      {confirming && (
        <RefillConfirm
          stamina={stamina}
          held={held}
          sending={sending}
          onRefill={(fragments) => void buy(fragments)}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
};
