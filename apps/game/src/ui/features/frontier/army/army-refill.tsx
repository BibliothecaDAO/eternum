import { useGame } from "@/hooks/context/game-context";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import { extractReadableErrorMessage } from "@/utils/error-message";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState } from "react";

import type { DockArmy } from "../hud/dock-armies";
import { useRealmLords } from "../value/use-realm-lords";
import { RefillButton, RefillConfirm } from "./refill";

/**
 * An army's Refill over the game's facts: the button priced at its missing points from the realm's LORDS, its confirm,
 * and refill_stamina. Nothing for a full bar or one not known yet.
 */
export const ArmyRefill = ({ army, realm }: { army: DockArmy; realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const held = useRealmLords(realm);
  const [confirming, setConfirming] = useState(false);
  const refilling = useInFlight("refill", army.explorerId) !== undefined;
  const stamina = army.stamina;
  if (!stamina || stamina.current >= stamina.max) return null;

  /** The confirm closes as the refill leaves; the army's Refill carries the wait, and a refusal says why. */
  const refill = async () => {
    const signer = account.account;
    if (!signer) return;
    try {
      await sendOnce("refill", army.explorerId, true, async () => {
        const sent = await setup.systemCalls.refill_stamina({ signer, explorerId: army.explorerId });
        setConfirming(false);
        return sent;
      });
    } catch (error) {
      toast.failed(error, "The refill could not be sent.");
    }
  };

  return (
    <>
      <RefillButton
        price={Math.ceil(stamina.max - stamina.current)}
        held={held}
        refilling={refilling}
        onRefill={() => setConfirming(true)}
      />
      {confirming && (
        <RefillConfirm
          stamina={stamina}
          held={held}
          sending={refilling}
          onRefill={() => void refill()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
};
