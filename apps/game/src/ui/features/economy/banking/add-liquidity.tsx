import { configManager } from "@bibliothecadao/eternum";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import Button from "@/ui/design-system/atoms/button";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ConfirmationPopup } from "./confirmation-popup";
import { LiquidityResourceRow } from "./liquidity-resource-row";
import { LiquidityTableHeader } from "./liquidity-table";
import { ResourceBar } from "@/ui/features/economy/banking/resource-bar";
import { getBlockTimestamp } from "@bibliothecadao/eternum";

import {
  divideByPrecision,
  getBalance,
  getClosestBank,
  getEntityIdFromKeys,
  isMilitaryResource,
  MarketManager,
  multiplyByPrecision,
} from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, ID, resources, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const AddLiquidity = ({ entityId, listResourceId }: { entityId: ID; listResourceId: number }) => {
  const {
    account: { account },
    setup: { store, systemCalls },
  } = useGame();
  const revision = useNativeRevision([
    "ResourceBalance",
    "ResourceProduction",
    "ResourceWeight",
    "Market",
    "Liquidity",
    "Structure",
  ]);
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const playerStructures = useFactView(playerStructuresView);

  const playerStructureIds = playerStructures.map((structure) => structure.structure.entity_id);

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [openConfirmation, setOpenConfirmation] = useState(false);

  const marketManager = useMemo(
    () => new MarketManager(store, ContractAddress(account.address), resourceId),
    [store, resourceId, account.address, revision],
  );

  useEffect(() => {
    setResourceId(listResourceId);
  }, [listResourceId]);

  useEffect(() => {
    if (!marketManager.hasReserves()) return;
    const optimalResourceAmout = marketManager.quoteResource(lordsAmount);
    if (resourceAmount !== optimalResourceAmout) {
      setResourceAmount(optimalResourceAmout);
    }
  }, [lordsAmount]);

  useEffect(() => {
    if (!marketManager.hasReserves()) return;
    const optimalLordsAmout = marketManager.quoteLords(resourceAmount);
    if (lordsAmount !== optimalLordsAmout) {
      setLordsAmount(optimalLordsAmout);
    }
  }, [resourceAmount]);

  const lordsBalance = getBalance(entityId, Number(ResourcesIds.Lords), currentDefaultTick, store).balance;
  const resourceBalance = getBalance(entityId, Number(resourceId), currentDefaultTick, store).balance;
  const hasEnough =
    lordsBalance >= multiplyByPrecision(lordsAmount) && resourceBalance >= multiplyByPrecision(resourceAmount);

  const isNotZero = lordsAmount > 0 && resourceAmount > 0;
  const canAdd = hasEnough && isNotZero;

  const onAddLiquidity = () => {
    const closestBank = getClosestBank(entityId, store);

    if (!closestBank) return;

    setIsLoading(true);
    systemCalls
      .add_liquidity({
        signer: account,
        bank_entity_id: closestBank.bankId,
        entity_id: entityId,
        calls: [
          {
            resource_type: resourceId,
            resource_amount: multiplyByPrecision(resourceAmount),
            lords_amount: multiplyByPrecision(lordsAmount),
          },
        ],
      })
      .finally(() => {
        setIsLoading(false);
        setOpenConfirmation(false);
      });
  };

  const renderConfirmationPopup = useCallback(() => {
    const isVillageAndMilitaryResource =
      store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base.category ===
        StructureType.Village && isMilitaryResource(resourceId);

    const resourcesToConfirm = [
      { amount: resourceAmount, resourceId: Number(resourceId) },
      { amount: lordsAmount, resourceId: ResourcesIds.Lords },
    ];

    return (
      <ConfirmationPopup
        title="Confirm Deposit"
        isLoading={isLoading}
        onConfirm={onAddLiquidity}
        onCancel={() => setOpenConfirmation(false)}
        disabled={isVillageAndMilitaryResource}
      >
        <div className="flex items-center justify-center space-x-2">
          {isVillageAndMilitaryResource && (
            <div className="mb-4 p-2 bg-red/20 text-red rounded-md">
              Military resources cannot be traded from village structures.
            </div>
          )}
          {resourcesToConfirm.map((resource, index) => (
            <div key={index} className="flex items-center justify-center">
              <ResourceCost withTooltip amount={resource.amount} resourceId={resource.resourceId} />
            </div>
          ))}
        </div>
      </ConfirmationPopup>
    );
  }, [isLoading, onAddLiquidity, resourceAmount, resourceId, lordsAmount]);

  return (
    <>
      <div className=" p-1 ">
        <div className="p-2 mb-2 relative space-y-1">
          <ResourceBar
            entityId={entityId}
            resources={resources.filter((r) => r.id === Number(ResourcesIds.Lords))}
            amount={Math.floor(lordsAmount)}
            lordsFee={0}
            setAmount={setLordsAmount}
            resourceId={ResourcesIds.Lords}
            setResourceId={setResourceId}
            max={divideByPrecision(lordsBalance)}
          />

          <ResourceBar
            entityId={entityId}
            resources={resources.filter((r) => r.id !== Number(ResourcesIds.Lords))}
            amount={Math.floor(resourceAmount)}
            lordsFee={0}
            setAmount={setResourceAmount}
            resourceId={resourceId}
            setResourceId={setResourceId}
            max={divideByPrecision(resourceBalance)}
          />
        </div>
        <div className="p-2">
          <LiquidityTableHeader />
          <LiquidityResourceRow playerStructureIds={playerStructureIds} entityId={entityId} resourceId={resourceId} />
          <div className="w-full flex flex-col justify-center mt-4">
            <Button
              variant="primary"
              isLoading={false}
              disabled={!canAdd}
              className="text-brown bg-brown/90"
              onClick={() => setOpenConfirmation(true)}
            >
              Add Liquidity
            </Button>
            {!canAdd && (
              <div className="px-3 mt-2 mb-1 text-danger font-bold text-center">
                {!isNotZero && <div>Warning: Amount must be greater than zero</div>}
                {!hasEnough && <div>Warning: Not enough resources for this operation</div>}
              </div>
            )}
          </div>
        </div>
      </div>
      {openConfirmation && renderConfirmationPopup()}
    </>
  );
};

export default AddLiquidity;
