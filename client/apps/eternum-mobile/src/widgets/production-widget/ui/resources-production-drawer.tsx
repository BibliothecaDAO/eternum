import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { NumericInput } from "@/shared/ui/numeric-input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import {
  configManager,
  divideByPrecision,
  formatTime,
  getBuildingQuantity,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { getBuildingFromResource, RealmInfo, resources, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { Loader2Icon, PauseIcon, PlayIcon, Trash2Icon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LaborBuilding } from "../model/types";

interface ResourcesProductionDrawerProps {
  building: LaborBuilding;
  realm: RealmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResourceAmounts = {
  [key in ResourcesIds]?: number;
};

export const ResourcesProductionDrawer = ({ building, realm, open, onOpenChange }: ResourcesProductionDrawerProps) => {
  const {
    setup: {
      account: { account },
      systemCalls,
      components,
    },
  } = useDojo();

  const isVillage = realm.category === StructureType.Village;

  const [activeTab, setActiveTab] = useState<"raw" | "labor">("raw");
  const [isLoading, setIsLoading] = useState(false);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [isExtendLoading, setIsExtendLoading] = useState(false);
  const [outputAmount, setOutputAmount] = useState(0);
  const [inputAmounts, setInputAmounts] = useState<ResourceAmounts>({});
  const [laborInputAmounts, setLaborInputAmounts] = useState<ResourceAmounts>({});
  const [showDestroyConfirm, setShowDestroyConfirm] = useState(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const resourceManager = useResourceManager(realm.entityId);
  const outputResource = resources.find((r) => r.id === building.produced.resource);
  const laborConfig = configManager.getLaborConfig(building.produced.resource);
  const isActive = resourceManager.isActive(building.produced.resource);

  const shouldHideProductionForm =
    building.produced.resource === ResourcesIds.Wheat || building.produced.resource === ResourcesIds.Fish;

  useEffect(() => {
    setIsPaused(building.paused);
  }, [building.paused]);

  if (!outputResource) return null;

  const resourceBalances = useMemo(() => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    const inputs =
      activeTab === "raw"
        ? configManager.complexSystemResourceInputs[building.produced.resource]
        : configManager.simpleSystemResourceInputs[building.produced.resource];
    return inputs.map((resource) => {
      const balance = resourceManager.balanceWithProduction(currentBlockTimestamp, resource.resource).balance;
      return { resource: resource.resource, balance: divideByPrecision(balance) };
    }, 0);
  }, [resourceManager, building.produced.resource, activeTab]);

  const hasBalanceRaw = useMemo(() => {
    return resourceBalances.every((resource) => (inputAmounts[resource.resource] || 0) <= resource.balance);
  }, [resourceBalances, inputAmounts]);

  const hasBalanceLabor = useMemo(() => {
    return resourceBalances.every((resource) => (laborInputAmounts[resource.resource] || 0) <= resource.balance);
  }, [resourceBalances, laborInputAmounts]);

  const handleRawResourcesProduce = async () => {
    if (!ticks) return;
    const loadingState = isActive ? setIsExtendLoading : setIsLoading;
    loadingState(true);

    const calldata = {
      from_entity_id: realm.entityId,
      produced_resource_types: [building.produced.resource],
      production_cycles: [ticks],
      signer: account,
    };

    try {
      await systemCalls.burn_resource_for_resource_production(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      loadingState(false);
    }
  };

  const handleLaborResourcesProduce = async () => {
    if (!laborConfig) return;
    if (outputAmount > 0) {
      const loadingState = isActive ? setIsExtendLoading : setIsLoading;
      loadingState(true);
      const productionCycles = Math.floor(outputAmount / laborConfig?.resourceOutputPerInputResources);
      const calldata = {
        from_entity_id: realm.entityId,
        production_cycles: [productionCycles],
        produced_resource_types: [building.produced.resource],
        signer: account,
      };

      try {
        await systemCalls.burn_labor_for_resource_production(calldata);
      } catch (error) {
        console.error(error);
      } finally {
        loadingState(false);
      }
    }
  };

  const handlePauseResumeProduction = useCallback(async () => {
    setIsPauseLoading(true);
    const tileManager = new TileManager(components, systemCalls, {
      col: realm.position?.x || 0,
      row: realm.position?.y || 0,
    });

    try {
      const action = !isPaused ? tileManager.pauseProduction : tileManager.resumeProduction;
      await action(account, realm.entityId, building.innerCol, building.innerRow);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPauseLoading(false);
    }
  }, [
    components,
    systemCalls,
    realm.position,
    account,
    realm.entityId,
    building.innerCol,
    building.innerRow,
    isPaused,
  ]);

  const handleDestroyBuilding = useCallback(async () => {
    if (!showDestroyConfirm) {
      setShowDestroyConfirm(true);
      return;
    }

    const tileManager = new TileManager(components, systemCalls, {
      col: realm.position?.x || 0,
      row: realm.position?.y || 0,
    });

    try {
      await tileManager.destroyBuilding(account, realm.entityId, building.innerCol, building.innerRow);
      setShowDestroyConfirm(false);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
    }
  }, [
    components,
    systemCalls,
    realm.position,
    account,
    realm.entityId,
    building.innerCol,
    building.innerRow,
    showDestroyConfirm,
    onOpenChange,
  ]);

  const handleInputChange = (resourceId: ResourcesIds, value: number, isLabor: boolean = false) => {
    if (isLabor) {
      if (!laborConfig) return;

      // Find the specific resource configuration in labor inputs
      const resourceConfig = laborConfig.inputResources.find((r) => r.resource === resourceId);
      if (!resourceConfig) return;

      // Set the direct input amount for the changed resource with rounding
      setLaborInputAmounts((prev) => ({
        ...prev,
        [resourceId]: Math.round(value),
      }));

      // Calculate new output based on this input
      const newOutputAmount = Math.round(value / resourceConfig.amount) * laborConfig.resourceOutputPerInputResources;
      setOutputAmount(newOutputAmount);

      // Update other inputs proportionally with rounding
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        if (input.resource === resourceId) {
          return { ...acc, [input.resource]: Math.round(value) };
        }
        const inputAmount = Math.round((input.amount * newOutputAmount) / laborConfig.resourceOutputPerInputResources);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    } else {
      const inputs = configManager.complexSystemResourceInputs[building.produced.resource];
      const outputConfig = configManager.complexSystemResourceOutput[building.produced.resource];
      const resourceConfig = inputs.find((r) => r.resource === resourceId);
      if (!resourceConfig) return;

      // Calculate new output amount based on the changed input
      const newOutputAmount = Math.round((value * outputConfig.amount) / resourceConfig.amount);
      setOutputAmount(newOutputAmount);

      // Update all raw input amounts based on the new output amount
      const newInputs = inputs.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * newOutputAmount) / outputConfig.amount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setInputAmounts(newInputs);
    }
  };

  const handleMaxInput = (isLabor: boolean = false) => {
    if (isLabor) {
      if (!laborConfig) return;

      // Calculate max possible output based on available resources
      let minCycle = 1 << 30;
      laborConfig.inputResources.forEach((input) => {
        const balance = resourceBalances.find((r) => r.resource === input.resource)?.balance || 0;
        const count = Math.floor(balance / input.amount);
        if (count < minCycle) {
          minCycle = count;
        }
      });

      // Use the minimum possible output to ensure we don't exceed any resource
      const newOutputAmount = Math.max(1, minCycle) * laborConfig.resourceOutputPerInputResources;
      setOutputAmount(newOutputAmount);

      // Update all labor input amounts based on the new output amount with rounding
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * newOutputAmount) / laborConfig.resourceOutputPerInputResources);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    } else {
      const inputs = configManager.complexSystemResourceInputs[building.produced.resource];
      const outputConfig = configManager.complexSystemResourceOutput[building.produced.resource];

      // Calculate max possible output based on available resources
      const maxOutputs = inputs.map((input) => {
        const balance = resourceBalances.find((r) => r.resource === input.resource)?.balance || 0;
        return Math.floor((balance * outputConfig.amount) / input.amount);
      });

      // Use the minimum possible output to ensure we don't exceed any resource
      const newOutputAmount = Math.max(1, Math.min(...maxOutputs));
      setOutputAmount(newOutputAmount);

      // Update all raw input amounts based on the new output amount
      const newInputs = inputs.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * newOutputAmount) / outputConfig.amount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setInputAmounts(newInputs);
    }
  };

  const handleOutputChange = (value: number) => {
    const roundedValue = Math.round(value);
    setOutputAmount(roundedValue);

    // Update input amounts based on the new output value
    if (activeTab === "raw") {
      const inputs = configManager.complexSystemResourceInputs[building.produced.resource];
      const outputConfig = configManager.complexSystemResourceOutput[building.produced.resource];
      const newInputs = inputs.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * roundedValue) / outputConfig.amount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setInputAmounts(newInputs);
    } else if (laborConfig) {
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * roundedValue) / laborConfig.resourceOutputPerInputResources);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    }
  };

  const buildingCount = useMemo(() => {
    return getBuildingQuantity(realm.entityId, getBuildingFromResource(building.produced.resource), components);
  }, [realm.entityId, building.produced.resource, components]);

  const ticks = Math.floor(outputAmount / configManager.simpleSystemResourceOutput[building.produced.resource].amount);

  const renderResourceRow = (resourceId: ResourcesIds, amount: number, isLabor: boolean = false) => {
    const resource = resources.find((r) => r.id === resourceId);
    if (!resource) return null;

    const availableAmount = resourceBalances.find((r) => r.resource === resourceId)?.balance ?? 0;

    return (
      <div key={resourceId} className="grid grid-cols-2 gap-4 py-2 items-center">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <ResourceIcon resourceId={resource.id} size={24} showTooltip />
            <span>{resource.trait}</span>
          </div>
          <span className="text-xs text-muted-foreground ml-8">Balance: {Math.round(availableAmount)}</span>
        </div>
        <div className="flex justify-end">
          <NumericInput
            value={isLabor ? (laborInputAmounts[resourceId] ?? amount) : (inputAmounts[resourceId] ?? amount)}
            onChange={(value) => handleInputChange(resourceId, value, isLabor)}
            className="w-32"
            label={`Enter Amount`}
            description={`Max: ${Math.round(availableAmount)}`}
            max={availableAmount}
          />
        </div>
      </div>
    );
  };

  const renderProductionRate = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-md">
          <span className="text-sm text-muted-foreground">Resource Type:</span>
          <div className="flex items-center gap-2">
            <ResourceIcon resourceId={building.produced.resource} size={20} showTooltip />
            <span className="font-medium">{outputResource?.trait}</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-md">
          <span className="text-sm text-center text-muted-foreground">
            This resource produces automatically from farms and fishing villages. Use the controls below to pause/resume
            or destroy the building.
          </span>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (shouldHideProductionForm) {
      return renderProductionRate();
    }

    const rawInputs = configManager.complexSystemResourceInputs[building.produced.resource];
    const laborInputs = laborConfig?.inputResources || [];

    return (
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const newTab = v as "raw" | "labor";
          setActiveTab(newTab);

          // Recalculate output amount based on the new tab's inputs
          if (newTab === "raw") {
            const inputs = configManager.complexSystemResourceInputs[building.produced.resource];
            const outputConfig = configManager.complexSystemResourceOutput[building.produced.resource];
            // Find first non-zero input or use first input
            const firstInput = inputs.find((input) => (inputAmounts[input.resource] ?? 0) > 0) || inputs[0];
            if (firstInput) {
              const inputAmount = inputAmounts[firstInput.resource] ?? 0;
              const newOutputAmount = Math.round((inputAmount * outputConfig.amount) / firstInput.amount);
              setOutputAmount(newOutputAmount);
            }
          } else if (newTab === "labor" && laborConfig) {
            // Find first non-zero labor input or use first input
            const firstInput =
              laborConfig.inputResources.find((input) => (laborInputAmounts[input.resource] ?? 0) > 0) ||
              laborConfig.inputResources[0];
            if (firstInput) {
              const inputAmount = laborInputAmounts[firstInput.resource] ?? 0;
              const newOutputAmount = Math.round(inputAmount / firstInput.amount);
              setOutputAmount(newOutputAmount);
            }
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="raw">Raw Mode</TabsTrigger>
          <TabsTrigger value="labor" disabled={!laborConfig}>
            Labor Mode
          </TabsTrigger>
        </TabsList>
        <TabsContent value="raw" className="mt-4">
          <div className="space-y-4">
            {rawInputs.map((input) => renderResourceRow(input.resource, input.amount))}
            <Button variant="outline" size="sm" onClick={() => handleMaxInput(false)} className="w-full">
              Max
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="labor" className="mt-4">
          <div className="space-y-4">
            {laborInputs.map((input) => renderResourceRow(input.resource, input.amount, true))}
            <Button variant="outline" size="sm" onClick={() => handleMaxInput(true)} className="w-full">
              Max
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    );
  };

  const { currentBlockTimestamp } = getBlockTimestamp();
  const timeLeft = resourceManager.timeUntilValueReached(currentBlockTimestamp, building.produced.resource);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-3xl font-bokor">Manage Production</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          {renderContent()}

          {!shouldHideProductionForm && (
            <Card className="mt-6">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <ResourceIcon resourceId={outputResource.id} size={24} showTooltip />
                      <span>{outputResource.trait}</span>
                    </div>
                  </div>
                  <NumericInput
                    value={outputAmount}
                    onChange={handleOutputChange}
                    className="w-24"
                    label={`Enter Amount`}
                    description={outputResource.trait}
                  />
                </div>

                <div className="flex items-center gap-2 justify-center p-2 bg-white/5 rounded-md">
                  <span className="text-gold/80">Production Time:</span>
                  <span className="font-medium">
                    {formatTime(Math.floor((ticks / buildingCount) * (isVillage ? 2 : 1)))}
                  </span>
                </div>

                {isActive && timeLeft > 0 && (
                  <div className="flex items-center gap-2 justify-center p-2 bg-primary/5 rounded-md">
                    <span className="text-primary/80">Time Left:</span>
                    <span className="font-medium">{formatTime(timeLeft)}</span>
                  </div>
                )}

                {isPaused && (
                  <div className="flex items-center gap-2 justify-center p-2 bg-destructive/50 rounded-md">
                    <span className="text-white/50">Production Paused</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="mt-6 flex gap-2">
            {shouldHideProductionForm ? (
              <>
                <Button
                  variant="outline"
                  onClick={handlePauseResumeProduction}
                  disabled={isPauseLoading}
                  className="flex-1"
                >
                  {isPauseLoading ? (
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  ) : isPaused ? (
                    <PlayIcon className="mr-2 h-4 w-4" />
                  ) : (
                    <PauseIcon className="mr-2 h-4 w-4" />
                  )}
                  {isPauseLoading ? "Loading..." : isPaused ? "Resume" : "Pause"}
                </Button>
                <Button variant="destructive" onClick={handleDestroyBuilding} disabled={isPauseLoading}>
                  {showDestroyConfirm ? "Confirm Destroy" : <Trash2Icon className="h-4 w-4" />}
                </Button>
              </>
            ) : (
              <>
                {(isActive && timeLeft > 0) || isPaused || isPauseLoading ? (
                  <>
                    <Button
                      className="flex-1"
                      onClick={activeTab === "raw" ? handleRawResourcesProduce : handleLaborResourcesProduce}
                      disabled={isExtendLoading || isPauseLoading}
                    >
                      {isExtendLoading ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Extending...
                        </>
                      ) : (
                        "Extend"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePauseResumeProduction}
                      disabled={isExtendLoading || isPauseLoading}
                    >
                      {isPauseLoading ? (
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPaused ? (
                        <PlayIcon className="h-4 w-4" />
                      ) : (
                        <PauseIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDestroyBuilding}
                      disabled={isExtendLoading || isPauseLoading}
                    >
                      {showDestroyConfirm ? "Confirm" : <Trash2Icon className="h-4 w-4" />}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      className="flex-1"
                      onClick={activeTab === "raw" ? handleRawResourcesProduce : handleLaborResourcesProduce}
                      disabled={isLoading || outputAmount <= 0 || !hasBalanceRaw || !hasBalanceLabor}
                    >
                      {isLoading ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Starting Production...
                        </>
                      ) : !hasBalanceRaw ? (
                        "Insufficient Raw Resources"
                      ) : !hasBalanceLabor ? (
                        "Insufficient Labor Resources"
                      ) : (
                        "Start Production"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handlePauseResumeProduction}
                      disabled={isLoading || isPauseLoading}
                    >
                      {isPauseLoading ? (
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      ) : isPaused ? (
                        <PlayIcon className="h-4 w-4" />
                      ) : (
                        <PauseIcon className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDestroyBuilding}
                      disabled={isLoading || isPauseLoading}
                    >
                      {showDestroyConfirm ? "Confirm" : <Trash2Icon className="h-4 w-4" />}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
