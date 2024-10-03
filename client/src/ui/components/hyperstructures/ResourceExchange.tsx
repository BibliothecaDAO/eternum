import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { getResourcesUtils } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat, divideByPrecision, multiplyByPrecision } from "@/ui/utils/utils";
import { ID, ResourcesIds } from "@bibliothecadao/eternum";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

type ResourceExchangeProps = {
  giverArmyName: string;
  takerArmy?: ArmyInfo;
  giverArmyEntityId: ID;
  structureEntityId?: ID;
  allowReverse?: boolean;
};

export const ResourceExchange = ({
  giverArmyName,
  giverArmyEntityId,
  structureEntityId,
  takerArmy,
  allowReverse,
}: ResourceExchangeProps) => {
  const {
    setup: {
      account: { account },
      systemCalls: { send_resources },
    },
  } = useDojo();

  const { getResourcesFromBalance } = getResourcesUtils();

  const [loading, setLoading] = useState<boolean>(false);
  const [transferDirection, setTransferDirection] = useState<"to" | "from">("to");
  const [resourcesGiven, setResourcesGiven] = useState<Record<number, number>>(
    Object.keys(ResourcesIds)
      .filter((key) => !isNaN(Number(key)))
      .reduce(
        (acc, key) => {
          acc[Number(key)] = 0;
          return acc;
        },
        {} as Record<number, number>,
      ),
  );

  const giverArmyResources = useMemo(() => getResourcesFromBalance(giverArmyEntityId), [loading]);
  const takerArmyResources = useMemo(() => getResourcesFromBalance(takerArmy?.entity_id!), [loading]);

  const handleResourceGivenChange = (resourceId: number, amount: number) => {
    setResourcesGiven({ ...resourcesGiven, [resourceId]: amount });
  };

  const selectedResourceIds = useMemo(() => Object.keys(resourcesGiven).map(Number), [resourcesGiven]);
  const selectedResourceAmounts = useMemo(() => resourcesGiven, [resourcesGiven]);

  const resourcesList = useMemo(() => {
    return selectedResourceIds.flatMap((id: number) => [Number(id), multiplyByPrecision(selectedResourceAmounts[id])]);
  }, [selectedResourceIds, selectedResourceAmounts]);

  const transferResources = async () => {
    setLoading(true);
    const fromArmyId = transferDirection === "to" ? giverArmyEntityId : takerArmy?.entity_id || structureEntityId;
    const toArmyId = transferDirection === "to" ? takerArmy?.entity_id || structureEntityId : giverArmyEntityId;

    await send_resources({
      signer: account,
      sender_entity_id: fromArmyId!,
      recipient_entity_id: toArmyId!,
      resources: resourcesList,
    });

    setLoading(false);
    setResourcesGiven(Object.fromEntries(Object.keys(resourcesGiven).map((key) => [key, 0])));
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-around items-center">
        <div className="w-[60%] mr-1 bg-gold/20">
          <p className="pt-2 pb-1 text-center">{giverArmyName}</p>
          {(transferDirection === "from" ? takerArmyResources : giverArmyResources).map((resource) => {
            const amount =
              transferDirection === "from"
                ? giverArmyResources.find((giverResource) => giverResource.resourceId === resource.resourceId)
                    ?.amount || 0
                : resource.amount;
            return (
              <ResourceRow
                key={resource.resourceId}
                resourceId={resource.resourceId}
                amount={amount}
                givenAmount={resourcesGiven[resource.resourceId]}
                onChangeAmount={(newAmount: number) => handleResourceGivenChange(resource.resourceId, newAmount)}
                transferDirection={transferDirection}
              />
            );
          })}
        </div>

        <div className="w-[60%] ml-1 bg-gold/20">
          <p className="pt-2 pb-1 text-center">Transfer {transferDirection}</p>
          {(transferDirection === "to" ? giverArmyResources : takerArmyResources).map((resource) => {
            const amount =
              transferDirection === "to"
                ? takerArmyResources.find((takerResource) => takerResource.resourceId === resource.resourceId)
                    ?.amount || 0
                : resource.amount;
            return (
              <ResourceRow
                key={resource.resourceId}
                resourceId={resource.resourceId}
                amount={amount}
                givenAmount={resourcesGiven[resource.resourceId]}
                onChangeAmount={(newAmount: number) => handleResourceGivenChange(resource.resourceId, newAmount)}
                transferDirection={transferDirection === "to" ? "from" : "to"}
              />
            );
          })}
        </div>
      </div>

      {allowReverse && (
        <div className="mt-3 w-full flex justify-center">
          <Button
            className="self-center m-auto h-[3vh] p-4"
            size="md"
            onClick={() => {
              setTransferDirection(transferDirection === "to" ? "from" : "to");
              setResourcesGiven(Object.fromEntries(Object.keys(resourcesGiven).map((key) => [key, 0])));
            }}
          >
            <ArrowRight size={24} className={`${transferDirection === "to" ? "" : "rotate-180"} duration-300`} />
          </Button>
        </div>
      )}

      <Button
        onClick={transferResources}
        isLoading={loading}
        variant="primary"
        className="mt-3"
        disabled={Object.values(resourcesGiven).every((amount) => amount === 0)}
      >
        Transfer Resources
      </Button>
    </div>
  );
};

type ResourceRowProps = {
  resourceId: ID;
  amount: number;
  givenAmount: number;
  onChangeAmount: (value: number) => void;
  transferDirection: string;
};

const ResourceRow = ({ resourceId, amount, givenAmount, onChangeAmount, transferDirection }: ResourceRowProps) => {
  return (
    <div className="grid grid-cols-6 hover:bg-gold/30 justify-around items-center h-12 gap-2 px-1 mb-1">
      <ResourceIcon withTooltip={false} resource={ResourcesIds[resourceId]} size="lg" />
      <div className="flex flex-col text-xs text-center self-center font-bold col-span-2">
        <p>Avail.</p>
        <p className={transferDirection === "to" && givenAmount !== 0 ? "text-red" : ""}>
          {transferDirection === "to"
            ? currencyFormat(Number(amount - multiplyByPrecision(givenAmount)), 0)
            : currencyFormat(Number(amount + multiplyByPrecision(givenAmount)), 0)}
        </p>
      </div>
      {transferDirection === "to" ? (
        <NumberInput
          className="col-span-3 rounded-lg"
          max={divideByPrecision(amount)}
          min={0}
          step={100}
          value={givenAmount}
          onChange={(newAmount) => onChangeAmount(newAmount)}
        />
      ) : (
        <div className={`text-lg font-bold col-span-3 text-center ${givenAmount !== 0 ? "text-green" : ""}`}>
          {`+${givenAmount}`}
        </div>
      )}
    </div>
  );
};
