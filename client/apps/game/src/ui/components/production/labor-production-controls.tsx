import Button from "@/ui/elements/button";
import { NumberInput } from "@/ui/elements/number-input";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SelectResource } from "@/ui/elements/select-resource";
import { getLaborConfig } from "@/utils/labor";
import {
  divideByPrecision,
  findResourceById,
  getEntityIdFromKeys,
  multiplyByPrecision,
  RealmInfo,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

export const LaborProductionControls = ({
  productionAmount,
  setProductionAmount,
  realm,
}: {
  productionAmount: number;
  setProductionAmount: (value: number) => void;
  realm: RealmInfo;
}) => {
  const {
    setup: {
      account: { account },
      systemCalls: { burn_other_resources_for_labor_production },
      components: { Resource },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const handleProduce = async () => {
    setIsLoading(true);

    const calldata = {
      entity_id: realm.entityId,
      resource_types: [selectedLaborResource],
      resource_amounts: [multiplyByPrecision(productionAmount)],
      signer: account,
    };

    console.log({ calldata });

    try {
      await burn_other_resources_for_labor_production(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const [selectedLaborResource, setSelectedLaborResource] = useState<number>(ResourcesIds.Wood);

  const laborConfig = useMemo(() => {
    return getLaborConfig(selectedLaborResource);
  }, [selectedLaborResource]);

  const { laborAmount, ticks } = useMemo(() => {
    if (!laborConfig) return { laborAmount: 0, ticks: 0 };

    console.log({ laborConfig });

    const laborAmount = productionAmount * laborConfig.laborProductionPerResource;

    const ticks = Math.ceil(laborAmount / laborConfig.laborRatePerTick);

    console.log({ laborAmount, ticks, laborConfig: laborConfig.laborRatePerTick });

    return { laborAmount, ticks };
  }, [laborConfig, productionAmount]);

  const resourceConsumption = useMemo(() => {
    if (!laborConfig) return { wheat: 0, fish: 0 };
    return {
      wheat: laborAmount * laborConfig.wheatBurnPerLabor || 0,
      fish: laborAmount * laborConfig.fishBurnPerLabor || 0,
    };
  }, [laborConfig, productionAmount]);

  const availableResources = useMemo(() => {
    return Object.values(ResourcesIds)
      .filter((id) => typeof id === "number")
      .map((id) => ({
        id: id as number,
        balance: getComponentValue(Resource, getEntityIdFromKeys([BigInt(realm.entityId), BigInt(id)]))?.balance || 0,
      }));
  }, [realm.entityId]);

  const calculateMaxProduction = useMemo(() => {
    if (!laborConfig) return 0;

    const selectedResourceBalance = divideByPrecision(
      Number(availableResources.find((r) => r.id === selectedLaborResource)?.balance || 0),
    );

    const maxAmounts = [selectedResourceBalance];

    if (laborConfig.wheatBurnPerLabor > 0) {
      const wheatBalance = divideByPrecision(
        Number(availableResources.find((r) => r.id === ResourcesIds.Wheat)?.balance || 0),
      );
      maxAmounts.push(Math.floor(wheatBalance / laborConfig.wheatBurnPerLabor));
    }

    if (laborConfig.fishBurnPerLabor > 0) {
      const fishBalance = divideByPrecision(
        Number(availableResources.find((r) => r.id === ResourcesIds.Fish)?.balance || 0),
      );
      maxAmounts.push(Math.floor(fishBalance / laborConfig.fishBurnPerLabor));
    }

    return Math.max(0, Math.min(...maxAmounts));
  }, [availableResources, laborConfig, selectedLaborResource]);

  const handleMaxClick = () => {
    setProductionAmount(calculateMaxProduction);
  };

  return (
    <div className="bg-brown/20 p-4 rounded-lg">
      <h3 className="text-2xl font-bold mb-4">Labor Production</h3>

      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <h4 className="text-xl mb-2">Select Resource to Convert</h4>
          <SelectResource
            onSelect={(resourceId) => setSelectedLaborResource(resourceId || ResourcesIds.Wood)}
            className="w-full bg-dark-brown rounded border border-gold/30"
            realmProduction={true}
          />
        </div>

        {selectedLaborResource && (
          <div className="flex-1">
            <h4 className="text-xl mb-2">Input Amount</h4>
            <div className="flex items-center gap-3">
              <ResourceIcon resource={ResourcesIds[selectedLaborResource]} size="sm" />
              <div className="flex items-center justify-between w-full">
                <div className="w-2/3">
                  <NumberInput
                    value={productionAmount}
                    onChange={setProductionAmount}
                    min={1}
                    max={calculateMaxProduction}
                    className="rounded-md border-gold/30 hover:border-gold/50"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMaxClick}
                    className="px-2 py-1 text-sm bg-gold/20 hover:bg-gold/30 text-gold rounded"
                  >
                    MAX
                  </button>
                  <span className="text-sm font-medium text-gold/60">
                    {divideByPrecision(
                      Number(availableResources.find((r) => r.id === selectedLaborResource)?.balance || 0),
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedLaborResource && (
        <>
          <div className="mb-4 p-4 rounded-lg border-2 border-gold/30">
            <h4 className="text-xl mb-2">Production Details</h4>
            <div className="space-y-3 text-gold/80">
              <div className="flex items-center gap-2">
                <ResourceIcon resource={findResourceById(ResourcesIds.Labor)?.trait || ""} size="sm" />
                <span>Labor Generated:</span>
                <span className="font-medium">{laborAmount}</span>
              </div>

              {resourceConsumption.wheat > 0 && (
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={findResourceById(ResourcesIds.Wheat)?.trait || ""} size="sm" />
                  <span>Wheat Consumed:</span>
                  <span className="font-medium">{resourceConsumption.wheat}</span>
                  <span className="text-sm text-gold/60">
                    (Available:{" "}
                    {divideByPrecision(
                      Number(availableResources.find((r) => r.id === ResourcesIds.Wheat)?.balance || 0),
                    )}
                    )
                  </span>
                </div>
              )}

              {resourceConsumption.fish > 0 && (
                <div className="flex items-center gap-2">
                  <ResourceIcon resource={findResourceById(ResourcesIds.Fish)?.trait || ""} size="sm" />
                  <span>Fish Consumed:</span>
                  <span className="font-medium">{resourceConsumption.fish}</span>
                  <span className="text-sm text-gold/60">
                    (Available:{" "}
                    {divideByPrecision(
                      Number(availableResources.find((r) => r.id === ResourcesIds.Fish)?.balance || 0),
                    )}
                    )
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 justify-center p-2 bg-white/5 rounded-md">
                <span>Time Required:</span>
                <span className="font-medium">
                  {(() => {
                    const days = Math.floor(ticks / (24 * 60 * 60));
                    const hours = Math.floor((ticks % (24 * 60 * 60)) / (60 * 60));
                    const minutes = Math.floor((ticks % (60 * 60)) / 60);
                    const seconds = ticks % 60;

                    return [
                      days > 0 ? `${days}d ` : "",
                      hours > 0 ? `${hours}h ` : "",
                      minutes > 0 ? `${minutes}m ` : "",
                      `${seconds}s`,
                    ].join("");
                  })()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleProduce}
              disabled={!selectedLaborResource || productionAmount <= 0}
              isLoading={isLoading}
              variant="primary"
              className="px-8 py-2"
            >
              Start Labor Production
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
