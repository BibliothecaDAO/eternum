import { useGame } from "@/hooks/context/game-context";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

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
  const { confirming, ask, close } = useConfirmFor(army.explorerId);
  const refilling = useInFlight("refill", army.explorerId) !== undefined;
  const stamina = army.stamina;
  if (!stamina || stamina.current >= stamina.max) return null;

  /** The confirm closes as the refill leaves; the army's Refill carries the wait, and a refusal says why. */
  const refill = async (amount: number) => {
    const signer = account.account;
    if (!signer) return;
    try {
      await sendOnce("refill", army.explorerId, true, async () => {
        const sent = await setup.systemCalls.refill_stamina({ signer, explorerId: army.explorerId, amount });
        close();
        return sent;
      });
    } catch (error) {
      toast.failed(error, "The refill could not be sent.");
    }
  };

  return (
    <>
      <RefillButton held={held} refilling={refilling} onRefill={ask} />
      {confirming && (
        <RefillConfirm
          stamina={stamina}
          held={held}
          sending={refilling}
          onRefill={(amount) => void refill(amount)}
          onCancel={close}
        />
      )}
    </>
  );
};
