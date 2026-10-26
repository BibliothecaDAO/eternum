import { heldAgainstNeed } from "@/ui/design-system/kit/words";
import { useCurrentDefaultTick, useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useGame } from "@/hooks/context/game-context";

import {
  bankPickupTravelSeconds,
  calculateDonkeysNeeded,
  deliveryLandsAt,
  divideByPrecision,
  getTotalResourceWeightKg,
  isMilitaryResource,
} from "@bibliothecadao/eternum";
import { useResourceManager } from "@/hooks/helpers/use-resources";
import { ResourcesIds, type ID, type Resource, formatClockTime } from "@bibliothecadao/types";
import { useEffect } from "react";

/**
 * A bank pickup's carriage: when the goods land at the structure, and the donkeys it takes (their weight is how the
 * chain counts them, never shown: the donkeys are what a player has or lacks). The landing
 * is the chain's: the donkeys' round trip from the bank, at the troops' pace when troops are among the goods, landing
 * at the end of the delivery tick it ends in.
 */
export const TravelInfo = ({
  entityId,
  bankId,
  resources,
  setCanCarry,
  isAmm,
}: {
  entityId: ID;
  bankId: ID;
  /** The goods the donkeys bring back from the bank. */
  resources: Resource[];
  setCanCarry?: (canContinue: boolean) => void;
  isAmm?: boolean;
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const resourceManager = useResourceManager(entityId);
  const currentDefaultTick = useCurrentDefaultTick();
  const resourceWeightKg = getTotalResourceWeightKg(resources);
  const neededDonkeys = calculateDonkeysNeeded(resourceWeightKg);
  const transferredDonkeys = isAmm
    ? 0
    : (resources.find((resource) => resource.resourceId === ResourcesIds.Donkey)?.amount ?? 0);
  // Undefined when this client cannot see the sender's donkeys: nothing can then be carried.
  const heldDonkeys = resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey)?.balance;
  const donkeyBalance =
    heldDonkeys === undefined ? undefined : divideByPrecision(heldDonkeys, false) - transferredDonkeys;
  const onlyWeightlessResources = resources.every(
    (resource) => resource.resourceId === ResourcesIds.Donkey || resource.resourceId === ResourcesIds.Lords,
  );
  const canCarry = onlyWeightlessResources || (donkeyBalance !== undefined && donkeyBalance >= neededDonkeys);
  const road = bankPickupTravelSeconds(
    bankId,
    entityId,
    setup.store,
    resources.some((resource) => isMilitaryResource(resource.resourceId)),
  );
  const formattedArrivalTime = road === undefined ? "" : formatClockTime(deliveryLandsAt(now, road));

  useEffect(() => {
    setCanCarry?.(canCarry);
  }, [canCarry, setCanCarry]);

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {formattedArrivalTime && (
          <>
            <dt className="text-right text-hud-label text-hud-muted">Estimated Arrival</dt>
            <dd className="text-hud-strong">{formattedArrivalTime}</dd>
          </>
        )}
        <dt className="text-right text-hud-label text-hud-muted">Donkeys Burnt for Transfer</dt>
        <dd className={canCarry ? "text-hud-strong text-hud-good" : "text-hud-strong text-hud-bad"}>
          🔥🫏 {heldAgainstNeed(donkeyBalance, neededDonkeys)}
        </dd>
      </dl>
    </div>
  );
};
