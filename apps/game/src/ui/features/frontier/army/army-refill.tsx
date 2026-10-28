import { useGame } from "@/hooks/context/game-context";
import { useConfirmFor } from "@/hooks/helpers/use-confirm-for";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import type { DockArmy } from "../hud/dock-armies";
import { useRealmLords } from "../value/use-realm-lords";
import { RefillButton, RefillChip, RefillConfirm, StaminaRefill } from "./refill";

/**
 * An army's Refill over the game's facts, priced at its missing points from the realm's LORDS: the order bar's button,
 * the army card's chip or a phone's picked army's stamina; its confirm, and refill_stamina. Nothing for a bar not known
 * yet; for a full one, only the stamina.
 */
export const ArmyRefill = ({
  army,
  realm,
  look = "button",
}: {
  army: DockArmy;
  realm: NativeRows["Structure"];
  /** The order bar's button, the army card's chip, or the stamina beside a phone's picked army. */
  look?: "button" | "chip" | "stamina";
}) => {
  const { setup, account } = useGame();
  const held = useRealmLords(realm);
  const { confirming, ask, close } = useConfirmFor(army.explorerId);
  const refilling = useInFlight("refill", army.explorerId) !== undefined;
  const stamina = army.stamina;
  if (!stamina) return null;
  const price = Math.ceil(stamina.max - stamina.current);
  const control = { held, refilling, onRefill: ask };

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
      {look === "stamina" && <StaminaRefill stamina={stamina} {...control} />}
      {look === "chip" && price > 0 && <RefillChip price={price} {...control} />}
      {look === "button" && price > 0 && <RefillButton {...control} />}
      {confirming && price > 0 && (
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
