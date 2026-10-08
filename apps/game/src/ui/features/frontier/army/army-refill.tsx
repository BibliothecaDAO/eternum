import { useGame } from "@/hooks/context/game-context";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { toast } from "@/ui/features/event-feed/notify";
import { knownBalance } from "@/ui/utils/utils";
import { extractReadableErrorMessage } from "@/utils/error-message";
import { getBalance } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { ResourcesIds } from "@bibliothecadao/types";
import { useState } from "react";

import type { DockArmy } from "../hud/dock-armies";
import { RefillButton, RefillConfirm } from "./refill";

const LORDS_MODELS = ["ResourceBalance"] as const;

/**
 * An army's Refill over the game's facts: the button priced at its missing points from the realm's LORDS, its confirm,
 * and refill_stamina. Nothing for a full bar or one not known yet.
 */
export const ArmyRefill = ({ army, realm }: { army: DockArmy; realm: NativeRows["Structure"] }) => {
  const { setup, account } = useGame();
  const tick = useCurrentDefaultTick();
  useNativeRevision(LORDS_MODELS);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const stamina = army.stamina;
  if (!stamina || stamina.current >= stamina.max) return null;
  const balance = knownBalance(getBalance(realm.entity_id, ResourcesIds.Lords, tick, setup.store).balance);
  const held = balance === undefined ? undefined : Math.floor(balance);

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
