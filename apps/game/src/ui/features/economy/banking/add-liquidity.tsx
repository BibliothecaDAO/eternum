import { configManager } from "@bibliothecadao/eternum";
import { useFactView } from "@/hooks/use-fact-view";
import { playerStructuresView } from "@/sync/fact-views";
import { useConfirmsLoss } from "@/hooks/helpers/use-confirm-for";
import { HudButton, HudConfirm, HudNotice } from "@/ui/design-system/kit/hud-elements";
import { PopoverPanel } from "@/ui/design-system/molecules/popover";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
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
import { useEffect, useMemo, useState } from "react";
import { toast } from "@/ui/features/event-feed/notify";

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

  const playerStructureIds = playerStructures.map((structure) => structure.entityId);

  const [isLoading, setIsLoading] = useState(false);
  const [resourceId, setResourceId] = useState<ResourcesIds>(ResourcesIds.Wood);
  const [lordsAmount, setLordsAmount] = useState(0);
  const [resourceAmount, setResourceAmount] = useState(0);
  const [openConfirmation, setOpenConfirmation] = useState(false);
  const confirmsLoss = useConfirmsLoss();

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
  // A balance this client cannot see never covers liquidity.
  const hasEnough =
    lordsBalance !== undefined &&
    resourceBalance !== undefined &&
    lordsBalance >= multiplyByPrecision(lordsAmount) &&
    resourceBalance >= multiplyByPrecision(resourceAmount);

  const isNotZero = lordsAmount > 0 && resourceAmount > 0;
  const canAdd = hasEnough && isNotZero;

  const onAddLiquidity = () => {
    const closestBank = getClosestBank(entityId, store);

    if (!closestBank) return;

    setIsLoading(true);
    return systemCalls
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
      .catch((error) => toast.failed(error, "The liquidity could not be added."))
      .finally(() => {
        setIsLoading(false);
        setOpenConfirmation(false);
      });
  };

  const isVillageAndMilitaryResource =
    store.get("Structure", { game_id: configManager.getActiveGameId(), entity_id: entityId })?.base.category ===
      StructureType.Village && isMilitaryResource(resourceId);
  // A deposit acts at once; in Frontier it asks first, with what it deposits.
  const pressAdd = () => (confirmsLoss ? setOpenConfirmation(true) : onAddLiquidity());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id === Number(ResourcesIds.Lords))}
          amount={Math.floor(lordsAmount)}
          lordsFee={0}
          setAmount={setLordsAmount}
          resourceId={ResourcesIds.Lords}
          setResourceId={setResourceId}
          max={lordsBalance === undefined ? 0 : divideByPrecision(lordsBalance)}
        />
        <ResourceBar
          entityId={entityId}
          resources={resources.filter((r) => r.id !== Number(ResourcesIds.Lords))}
          amount={Math.floor(resourceAmount)}
          lordsFee={0}
          setAmount={setResourceAmount}
          resourceId={resourceId}
          setResourceId={setResourceId}
          max={resourceBalance === undefined ? 0 : divideByPrecision(resourceBalance)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <LiquidityTableHeader />
        <LiquidityResourceRow playerStructureIds={playerStructureIds} entityId={entityId} resourceId={resourceId} />
      </div>
      {isVillageAndMilitaryResource && (
        <HudNotice tone="bad" line="Military resources cannot be traded from village structures." />
      )}
      {!isNotZero && <HudNotice tone="warn" line="Warning: Amount must be greater than zero" />}
      {!hasEnough && <HudNotice tone="bad" line="Warning: Not enough resources for this operation" />}
      <HudButton
        kind="primary"
        busy={isLoading ? "Depositing…" : undefined}
        disabled={!canAdd || isVillageAndMilitaryResource}
        onClick={pressAdd}
      >
        Add Liquidity
      </HudButton>
      {openConfirmation && (
        <PopoverPanel
          id="confirm"
          ariaLabel="Confirm Deposit"
          anchor="top-center"
          onDismiss={() => setOpenConfirmation(false)}
        >
          <HudConfirm
            question="Confirm Deposit"
            verb="Add Liquidity"
            onConfirm={onAddLiquidity}
            onBack={() => setOpenConfirmation(false)}
          >
            <span className="flex items-center justify-center gap-2">
              <ResourceCost withTooltip amount={resourceAmount} resourceId={Number(resourceId)} />
              <ResourceCost withTooltip amount={lordsAmount} resourceId={ResourcesIds.Lords} />
            </span>
          </HudConfirm>
        </PopoverPanel>
      )}
    </div>
  );
};

export default AddLiquidity;
