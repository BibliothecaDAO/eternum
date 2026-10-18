import { HudRow } from "@/ui/design-system/kit/hud-elements";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
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
import { ResourcesIds, type ID, type Resource, formatClockTime, formatExact } from "@bibliothecadao/types";
import { useEffect } from "react";

/**
 * A bank pickup's carriage: when the goods land at the structure, their weight, and the donkeys it burns. The landing
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
  const donkeyBalance = heldDonkeys === undefined ? undefined : divideByPrecision(heldDonkeys) - transferredDonkeys;
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
        <dt className="text-right text-hud-label text-hud-muted">Total Transfer Weight</dt>
        <dd className="text-hud-strong">{`${resourceWeightKg} kg`}</dd>
        <dt className="text-right text-hud-label text-hud-muted">Donkeys Burnt for Transfer</dt>
        <dd className={canCarry ? "text-hud-strong text-hud-good" : "text-hud-strong text-hud-bad"}>
          {formatExact(neededDonkeys)} 🔥🫏 [{donkeyBalance === undefined ? "—" : formatExact(donkeyBalance)}]
        </dd>
      </dl>
      <ResourceWeight />
    </div>
  );
};

/** What one unit of each kind of good weighs, the goods of each kind painted beside it. */
const WEIGHTS: { weight: string; kind?: string; resources: ResourcesIds[] }[] = [
  { weight: "0 kg/unit", resources: [ResourcesIds.Lords, ResourcesIds.Donkey] },
  { weight: "0.1 kg/unit", kind: "Fragment", resources: [ResourcesIds.AncientFragment] },
  { weight: "0.1 kg/unit", kind: "Food", resources: [ResourcesIds.Wheat, ResourcesIds.Fish] },
  { weight: "1 kg/unit", kind: "Resources", resources: [ResourcesIds.Wood, ResourcesIds.Stone, ResourcesIds.Gold] },
  {
    weight: "5 kg/unit",
    kind: "All Troops",
    resources: [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin],
  },
];

const ResourceWeight = () => (
  <div className="flex flex-col gap-1">
    <p className="text-hud-label italic text-hud-muted">Resource weights per unit:</p>
    <div className="grid grid-cols-2 gap-1">
      {WEIGHTS.map(({ weight, kind, resources }) => (
        <HudRow
          key={`${weight}-${kind ?? "none"}`}
          lead={
            <span className="flex items-center gap-1">
              {resources.map((resource) => (
                <ResourceIcon key={resource} resource={resource} size="sm" />
              ))}
            </span>
          }
          title={weight}
          detail={kind}
        />
      ))}
    </div>
  </div>
);
