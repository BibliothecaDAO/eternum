import { configManager } from "@/dojo/setup";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import { GRAMS_PER_KG } from "@/ui/constants";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import {
  calculateDonkeysNeeded,
  currencyFormat,
  divideByPrecision,
  getTotalResourceWeight,
  multiplyByPrecision,
} from "@/ui/utils/utils";
import { ResourcesIds, type ID, type Resource } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";

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
  const [resourceWeight, setResourceWeight] = useState(0);
  const [donkeyBalance, setDonkeyBalance] = useState(0);
  const neededDonkeys = useMemo(() => calculateDonkeysNeeded(resourceWeight), [resourceWeight]);

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    const totalWeight = getTotalResourceWeight(resources);

    const multipliedWeight = multiplyByPrecision(totalWeight);
    setResourceWeight(multipliedWeight);

    const { balance } = getBalance(entityId, ResourcesIds.Donkey);

    const currentDonkeyAmount = isAmm ? 0 : resources.find((r) => r.resourceId === ResourcesIds.Donkey)?.amount || 0;

    const calculatedDonkeyBalance = divideByPrecision(balance) - currentDonkeyAmount;

    setDonkeyBalance(calculatedDonkeyBalance);

    const onlyDonkeysAndLords = resources.every(
      (r) => r.resourceId === ResourcesIds.Donkey || r.resourceId === ResourcesIds.Lords,
    );

    if (setCanCarry) {
      // TODO: hacky way to set can carry to true if only donkeys and lords
      onlyDonkeysAndLords ? setCanCarry(true) : setCanCarry(calculatedDonkeyBalance >= neededDonkeys);
    }
  }, [resources, entityId, resourceWeight, donkeyBalance, setCanCarry]);

  return (
    <>
      <table className="w-full border-collapse text-sm">
        <tbody className="divide-y divide-gold/20">
          {travelTime ? (
            <tr className="hover:bg-gold/5 transition-colors">
              <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Travel Time</td>
              <td className="px-4 py-1 text-gold text-left whitespace-nowrap">
                {`${Math.floor(travelTime / 60)} hrs ${travelTime % 60} mins`}
              </td>
            </tr>
          ) : (
            ""
          )}
          <tr className="hover:bg-gold/5 transition-colors">
            <td className="px-4 py-1 font-semibold text-right whitespace-nowrap">Total Transfer Weight</td>
            <td className="px-4 py-1 text-gold text-left whitespace-nowrap">{`${currencyFormat(
              resourceWeight / GRAMS_PER_KG,
              0,
            )} kg`}</td>
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
    <div className={`text-xs text-gray-200 p-2 max-w-xs ${className}`}>
      <p className="font-semibold">Resource Weights</p>
      <div className="grid grid-cols-2 gap-x-4 my-1">
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Lords]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeight(ResourcesIds.Lords) / GRAMS_PER_KG} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wheat]} size="xs" className="mr-1" />
            {`(Food) ${configManager.getResourceWeight(ResourcesIds.Wheat) / GRAMS_PER_KG} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Wood]} size="xs" className="mr-1" />
            {`(Other) ${configManager.getResourceWeight(ResourcesIds.Wood) / GRAMS_PER_KG} kg/unit`}
          </li>
        </ul>
        <ul className="list-none">
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Knight]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeight(ResourcesIds.Knight) / GRAMS_PER_KG} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Crossbowman]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeight(ResourcesIds.Crossbowman) / GRAMS_PER_KG} kg/unit`}
          </li>
          <li className="flex items-center">
            <ResourceIcon resource={ResourcesIds[ResourcesIds.Paladin]} size="xs" className="mr-1" />
            {`${configManager.getResourceWeight(ResourcesIds.Paladin) / GRAMS_PER_KG} kg/unit`}
          </li>
        </ul>
      </div>
      <p className="italic text-xs">Each resource has a different weight per unit.</p>
    </div>
  );
};
