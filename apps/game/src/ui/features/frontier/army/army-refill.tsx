import { useGame } from "@/hooks/context/game-context";
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
  const [sending, setSending] = useState(false);
  const stamina = army.stamina;
  if (!stamina || stamina.current >= stamina.max) return null;

  const refill = async () => {
    if (!account.account) return;
    setSending(true);
    try {
      await setup.systemCalls.refill_stamina({ signer: account.account, explorerId: army.explorerId });
      setConfirming(false);
    } catch (error) {
      toast.error(extractReadableErrorMessage(error, "The refill could not be sent."));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <RefillButton price={Math.ceil(stamina.max - stamina.current)} held={held} onRefill={() => setConfirming(true)} />
      {confirming && (
        <RefillConfirm
          stamina={stamina}
          held={held}
          sending={sending}
          onRefill={() => void refill()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
};
