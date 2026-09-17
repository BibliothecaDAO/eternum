import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { calculateArrivalTime, formatArrivalTime } from "@/ui/utils/utils";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";

import { calculateDonkeysNeeded, divideByPrecision, getTotalResourceWeightKg } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { ResourcesIds, type ID, type Resource } from "@bibliothecadao/types";
import { useEffect } from "react";

export const TravelInfo = ({
  entityId,
  resources,
  travelTime,
  setCanCarry,
  isAmm,
}: {
  entityId: ID;
  resources: Resource[];
  travelTime?: number;
  setCanCarry?: (canContinue: boolean) => void;
  isAmm?: boolean;
}) => {
  const resourceManager = useResourceManager(entityId);
  const currentDefaultTick = useCurrentDefaultTick();
  const resourceWeightKg = getTotalResourceWeightKg(resources);
  const neededDonkeys = calculateDonkeysNeeded(resourceWeightKg);
  const transferredDonkeys = isAmm
    ? 0
    : (resources.find((resource) => resource.resourceId === ResourcesIds.Donkey)?.amount ?? 0);
  const donkeyBalance =
    divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Donkey).balance) -
    transferredDonkeys;
  const onlyWeightlessResources = resources.every(
    (resource) => resource.resourceId === ResourcesIds.Donkey || resource.resourceId === ResourcesIds.Lords,
  );
  const canCarry = onlyWeightlessResources || donkeyBalance >= neededDonkeys;
  const formattedArrivalTime = formatArrivalTime(calculateArrivalTime(travelTime));

  useEffect(() => {
    setCanCarry?.(canCarry);
  }, [canCarry, setCanCarry]);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <tbody className="divide-y divide-gold/20">
          {formattedArrivalTime ? (
            <tr className="hover:bg-gold/5 transition-colors">
              <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Estimated Arrival</td>
              <td className="px-4 py-1 text-gold text-left whitespace-nowrap">{formattedArrivalTime}</td>
            </tr>
          ) : (
            ""
          )}
          <tr className="hover:bg-gold/5 transition-colors">
            <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Total Transfer Weight</td>
            <td className="px-4 py-1 text-gold text-left whitespace-nowrap">{`${resourceWeightKg} kg`}</td>
          </tr>
          <tr className="hover:bg-gold/5 transition-colors">
            <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Donkeys Burnt for Transfer</td>
            <td
              className={`px-4 py-1 whitespace-nowrap text-left ${
                neededDonkeys > donkeyBalance ? "text-red" : "text-green"
              }`}
            >
              {neededDonkeys.toLocaleString()} 🔥🫏 [{donkeyBalance.toLocaleString()}]
            </td>
          </tr>
        </tbody>
      </table>
      <ResourceWeight className="mt-2 text-xs opacity-75" />
    </>
  );
};

const ResourceWeight = ({ className }: { className?: string }) => {
  return (
    <div className={`text-xs text-gray-200 mx-auto ${className}`}>
      <p className="italic text-xs">Resource weights per unit:</p>
      <div className="grid grid-cols-2 gap-x-2 gap-y-2 my-1">
        {/* Zero weight resources (Lords and Donkey) */}
        <div className="p-1.5 border border-gold/20 rounded-md bg-brown-900/30">
          <div className="text-center text-gold/90 text-xs font-medium">0 kg/unit</div>
          <div className="flex items-center justify-center gap-1.5">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="sm" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Donkey]} size="sm" />
          </div>
        </div>

        {/* Ancient Fragments */}
        <div className="p-1.5 border border-gold/20 rounded-md bg-brown-900/30">
          <div className="text-center text-gold/90 text-xs font-medium">0.1 kg/unit</div>
          <div className="flex items-center justify-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.AncientFragment]} size="sm" />
            <span className="ml-1 text-2xs">(Fragment)</span>
          </div>
        </div>

        {/* Food resources */}
        <div className="p-1.5 border border-gold/20 rounded-md bg-brown-900/30">
          <div className="text-center text-gold/90 text-xs font-medium">0.1 kg/unit</div>
          <div className="flex items-center justify-center gap-1.5">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="sm" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Fish]} size="sm" />
            <span className="ml-1 text-2xs">(Food)</span>
          </div>
        </div>

        {/* Resource materials */}
        <div className="p-1.5 border border-gold/20 rounded-md bg-brown-900/30">
          <div className="text-center text-gold/90 text-xs font-medium">1 kg/unit</div>
          <div className="flex items-center justify-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Stone]} size="xs" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Gold]} size="xs" />
            <span className="ml-1 text-2xs">(Resources)</span>
          </div>
        </div>

        {/* Troops */}
        <div className="p-1.5 border border-gold/20 rounded-md bg-brown-900/30 col-span-2">
          <div className="text-center text-gold/90 text-xs font-medium">5 kg/unit (All Troops)</div>
          <div className="flex items-center justify-center gap-1.5">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="sm" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="sm" />
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
};
