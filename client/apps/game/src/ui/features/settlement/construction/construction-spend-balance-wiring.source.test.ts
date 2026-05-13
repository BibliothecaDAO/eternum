// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("construction spend balance wiring", () => {
  it("uses effective construction balance in realm upgrade flows", () => {
    const castleSource = readSource("src/ui/modules/entity-details/realm/castle.tsx");
    const structureUpgradeSource = readSource("src/ui/modules/entity-details/hooks/use-structure-upgrade.ts");

    expect(castleSource).toContain("getEffectiveConstructionBalance");
    expect(castleSource).not.toContain(
      "const balance = getBalance(structureEntityId, resourceCost.resource, currentDefaultTick, dojo.setup.components);",
    );

    expect(structureUpgradeSource).toContain("getEffectiveConstructionBalance");
    expect(structureUpgradeSource).not.toContain(
      "const balance = getBalance(structureEntityId, cost.resource, currentDefaultTick, setup.components);",
    );
  });

  it("uses effective construction balance in banking flows", () => {
    const addLiquiditySource = readSource("src/ui/features/economy/banking/add-liquidity.tsx");
    const swapSource = readSource("src/ui/features/economy/banking/swap.tsx");
    const resourceBarSource = readSource("src/ui/features/economy/banking/resource-bar.tsx");
    const travelInfoSource = readSource("src/ui/features/economy/resources/travel-info.tsx");

    expect(addLiquiditySource).toContain("getEffectiveConstructionBalance");
    expect(addLiquiditySource).not.toContain(
      "const lordsBalance = getBalance(entityId, Number(ResourcesIds.Lords), currentDefaultTick, components).balance;",
    );

    expect(swapSource).toContain("getEffectiveConstructionBalance");
    expect(swapSource).not.toContain(
      "() => getBalance(entityId, ResourcesIds.Lords, currentDefaultTick, components).balance",
    );

    expect(resourceBarSource).toContain("getEffectiveConstructionBalance");
    expect(resourceBarSource).not.toContain(
      "divideByPrecision(getBalance(entityId, Number(resourceId), currentDefaultTick, dojo.setup.components).balance)",
    );

    expect(travelInfoSource).toContain("getEffectiveConstructionBalance");
    expect(travelInfoSource).not.toContain(
      "const { balance } = getBalance(entityId, ResourcesIds.Donkey, currentDefaultTick, dojo.setup.components);",
    );
  });

  it("uses effective construction balance in trading flows", () => {
    const unifiedTradePanelSource = readSource("src/ui/features/economy/trading/unified-trade-panel.tsx");
    const marketOrderPanelSource = readSource("src/ui/features/economy/trading/market-order-panel.tsx");

    expect(unifiedTradePanelSource).toContain("getEffectiveConstructionBalance");
    expect(unifiedTradePanelSource).not.toContain(
      "divideByPrecision(resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords).balance)",
    );

    expect(marketOrderPanelSource).toContain("getEffectiveConstructionBalance");
    expect(marketOrderPanelSource).not.toContain("Number(resourceManager.balance(ResourcesIds.Lords))");
    expect(marketOrderPanelSource).not.toContain(
      "resourceManager.balanceWithProduction(currentDefaultTick, ResourcesIds.Lords).balance",
    );
  });

  it("uses effective construction balance in troop allocation flows", () => {
    const armyManagementSource = readSource("src/ui/features/military/components/army-management-card.tsx");
    const armyCreationSource = readSource(
      "src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx",
    );
    const hyperstructureResourceChipSource = readSource(
      "src/ui/features/world/components/hyperstructures/hyperstructure-resource-chip.tsx",
    );

    expect(armyManagementSource).toContain("getEffectiveConstructionBalance");
    expect(armyManagementSource).not.toContain(
      "const balance = getBalance(owner_entity, resourceId, currentDefaultTick, components).balance;",
    );

    expect(armyCreationSource).toContain("getEffectiveConstructionBalance");
    expect(armyCreationSource).not.toContain(
      "const balance = getBalance(activeStructureId, resourceId, currentDefaultTick, components).balance;",
    );

    expect(hyperstructureResourceChipSource).toContain("getEffectiveConstructionBalance");
    expect(hyperstructureResourceChipSource).not.toContain(
      "getBalance(structureEntityId, resourceId, currentDefaultTick, dojo.setup.components).balance",
    );
  });

  it("uses effective construction balance in bridge flows", () => {
    const bridgeSource = readSource("src/ui/features/infrastructure/bridge/bridge.tsx");
    const realmTransferSource = readSource("src/ui/features/economy/resources/realm-transfer.tsx");

    expect(bridgeSource).toContain("getEffectiveConstructionBalance");
    expect(bridgeSource).not.toContain("resourceManager.balanceWithProduction(currentTick, r.resourceId).balance");
    expect(bridgeSource).not.toContain(
      "resourceManager.balanceWithProduction(currentTick, resource.resourceId).balance",
    );

    expect(realmTransferSource).toContain("getEffectiveConstructionBalanceRaw");
    expect(realmTransferSource).not.toContain("resourceManager.balanceWithProduction(tick, resource).balance");
    expect(realmTransferSource).not.toContain("sourceResourceManager.balanceWithProduction(tick, resource).balance");
  });

  it("subscribes mounted spending panels to construction intent changes", () => {
    const addLiquiditySource = readSource("src/ui/features/economy/banking/add-liquidity.tsx");
    const swapSource = readSource("src/ui/features/economy/banking/swap.tsx");
    const resourceBarSource = readSource("src/ui/features/economy/banking/resource-bar.tsx");
    const travelInfoSource = readSource("src/ui/features/economy/resources/travel-info.tsx");
    const armyManagementSource = readSource("src/ui/features/military/components/army-management-card.tsx");
    const armyCreationSource = readSource(
      "src/ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx",
    );
    const castleSource = readSource("src/ui/modules/entity-details/realm/castle.tsx");
    const structureUpgradeSource = readSource("src/ui/modules/entity-details/hooks/use-structure-upgrade.ts");
    const unifiedTradePanelSource = readSource("src/ui/features/economy/trading/unified-trade-panel.tsx");
    const marketOrderPanelSource = readSource("src/ui/features/economy/trading/market-order-panel.tsx");
    const hyperstructureResourceChipSource = readSource(
      "src/ui/features/world/components/hyperstructures/hyperstructure-resource-chip.tsx",
    );
    const bridgeSource = readSource("src/ui/features/infrastructure/bridge/bridge.tsx");
    const realmTransferSource = readSource("src/ui/features/economy/resources/realm-transfer.tsx");

    expect(addLiquiditySource).toContain("useConstructionIntentVersion");
    expect(swapSource).toContain("useConstructionIntentVersion");
    expect(resourceBarSource).toContain("useConstructionIntentVersion");
    expect(travelInfoSource).toContain("useConstructionIntentVersion");
    expect(armyManagementSource).toContain("useConstructionIntentVersion");
    expect(armyCreationSource).toContain("useConstructionIntentVersion");
    expect(castleSource).toContain("useConstructionIntentVersion");
    expect(structureUpgradeSource).toContain("useConstructionIntentVersion");
    expect(unifiedTradePanelSource).toContain("useConstructionIntentVersion");
    expect(marketOrderPanelSource).toContain("useConstructionIntentVersion");
    expect(hyperstructureResourceChipSource).toContain("useConstructionIntentVersion");
    expect(bridgeSource).toContain("useConstructionIntentVersion");
    expect(realmTransferSource).toContain("useConstructionIntentVersion");
  });
});
