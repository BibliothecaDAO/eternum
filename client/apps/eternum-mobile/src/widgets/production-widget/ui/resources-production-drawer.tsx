import { getLaborConfig } from "@/features/resources-production/lib/labor";
import { getBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
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
  multiplyByPrecision,
  RealmInfo,
  resources,
  ResourcesIds,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
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

  const [activeTab, setActiveTab] = useState<"raw" | "labor">("raw");
  const [isLoading, setIsLoading] = useState(false);
  const [outputAmount, setOutputAmount] = useState(0);
  const [inputAmounts, setInputAmounts] = useState<ResourceAmounts>({});
  const [laborInputAmounts, setLaborInputAmounts] = useState<ResourceAmounts>({});

  const resourceManager = useResourceManager(realm.entityId);
  const outputResource = resources.find((r) => r.id === building.produced.resource);
  const laborConfig = getLaborConfig(building.produced.resource);
  const isActive = resourceManager.isActive(building.produced.resource);

  if (!outputResource) return null;

  const handleRawResourcesProduce = async () => {
    if (!ticks) return;
    setIsLoading(true);

    try {
      await systemCalls.burn_other_predefined_resources_for_resources({
        from_entity_id: realm.entityId,
        produced_resource_types: [building.produced.resource],
        production_tick_counts: [ticks],
        signer: account,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaborResourcesProduce = async () => {
    if (!laborConfig) return;
    const laborNeeded = Math.round(laborConfig.laborBurnPerResource * outputAmount);

    if (outputAmount > 0 && laborNeeded > 0) {
      setIsLoading(true);

      try {
        await systemCalls.burn_labor_resources_for_other_production({
          from_entity_id: realm.entityId,
          labor_amounts: [multiplyByPrecision(laborNeeded)],
          produced_resource_types: [building.produced.resource],
          signer: account,
        });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handlePauseResumeProduction = async () => {
    setIsLoading(true);
    const tileManager = new TileManager(components, systemCalls, {
      col: realm.position?.x || 0,
      row: realm.position?.y || 0,
    });

    try {
      if (isActive) {
        await tileManager.pauseProduction(account, realm.entityId, 0, 0);
      } else {
        await tileManager.resumeProduction(account, realm.entityId, 0, 0);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (resourceId: ResourcesIds, value: number, isLabor: boolean = false) => {
    if (isLabor) {
      if (!laborConfig) return;

      // Find the specific resource configuration in labor inputs
      const resourceConfig = laborConfig.inputResources.find((r) => r.resource === resourceId);
      if (!resourceConfig) return;

      // Set the direct input amount for the changed resource
      setLaborInputAmounts((prev) => ({
        ...prev,
        [resourceId]: value,
      }));

      // Calculate new output based on this input
      const newOutputAmount = Math.round(value / resourceConfig.amount);
      setOutputAmount(newOutputAmount);

      // Update other inputs proportionally
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        if (input.resource === resourceId) {
          return { ...acc, [input.resource]: value };
        }
        const inputAmount = Math.round(input.amount * newOutputAmount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    } else {
      const inputs = configManager.resourceInputs[building.produced.resource];
      const outputConfig = configManager.resourceOutput[building.produced.resource];
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
      const maxOutputs = laborConfig.inputResources.map((input) => {
        const { currentBlockTimestamp } = getBlockTimestamp();
        const balance = resourceManager.balanceWithProduction(currentBlockTimestamp, input.resource);
        const availableAmount = Math.round(divideByPrecision(balance));
        return Math.floor(availableAmount / input.amount);
      });

      // Use the minimum possible output to ensure we don't exceed any resource
      const newOutputAmount = Math.max(1, Math.min(...maxOutputs));
      setOutputAmount(newOutputAmount);

      // Update all labor input amounts based on the new output amount
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        const inputAmount = Math.round(input.amount * newOutputAmount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    } else {
      const inputs = configManager.resourceInputs[building.produced.resource];
      const outputConfig = configManager.resourceOutput[building.produced.resource];

      // Calculate max possible output based on available resources
      const maxOutputs = inputs.map((input) => {
        const { currentBlockTimestamp } = getBlockTimestamp();
        const balance = resourceManager.balanceWithProduction(currentBlockTimestamp, input.resource);
        const availableAmount = Math.round(divideByPrecision(balance));
        return Math.floor((availableAmount * outputConfig.amount) / input.amount);
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
      const inputs = configManager.resourceInputs[building.produced.resource];
      const outputConfig = configManager.resourceOutput[building.produced.resource];
      const newInputs = inputs.reduce((acc, input) => {
        const inputAmount = Math.round((input.amount * roundedValue) / outputConfig.amount);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setInputAmounts(newInputs);
    } else if (laborConfig) {
      const newInputs = laborConfig.inputResources.reduce((acc, input) => {
        const inputAmount = Math.round(input.amount * roundedValue);
        return { ...acc, [input.resource]: inputAmount };
      }, {});
      setLaborInputAmounts(newInputs);
    }
  };

  const ticks = Math.floor(outputAmount / configManager.resourceOutput[building.produced.resource].amount);

  const renderResourceRow = (resourceId: ResourcesIds, amount: number, isLabor: boolean = false) => {
    const resource = resources.find((r) => r.id === resourceId);
    const { currentBlockTimestamp } = getBlockTimestamp();
    const balance = resourceManager.balanceWithProduction(currentBlockTimestamp, resourceId);
    const availableAmount = divideByPrecision(balance);

    if (!resource) return null;

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

  const renderContent = () => {
    const rawInputs = configManager.resourceInputs[building.produced.resource];
    const laborInputs = laborConfig?.inputResources || [];

    return (
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const newTab = v as "raw" | "labor";
          setActiveTab(newTab);

          // Recalculate output amount based on the new tab's inputs
          if (newTab === "raw") {
            const inputs = configManager.resourceInputs[building.produced.resource];
            const outputConfig = configManager.resourceOutput[building.produced.resource];
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

  const formatProductionTime = (ticks: number) => {
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
                <span className="font-medium">{formatProductionTime(ticks)}</span>
              </div>

              {isActive && timeLeft > 0 && (
                <div className="flex items-center gap-2 justify-center p-2 bg-primary/5 rounded-md">
                  <span className="text-primary/80">Time Left:</span>
                  <span className="font-medium">{formatTime(timeLeft)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 flex gap-2">
            {isActive && timeLeft > 0 ? (
              <>
                <Button
                  className="flex-1"
                  onClick={activeTab === "raw" ? handleRawResourcesProduce : handleLaborResourcesProduce}
                  disabled={isLoading}
                >
                  Extend
                </Button>
                <Button variant="destructive" onClick={handlePauseResumeProduction} disabled={isLoading}>
                  {isActive ? "Pause" : "Resume"}
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={activeTab === "raw" ? handleRawResourcesProduce : handleLaborResourcesProduce}
                disabled={isLoading || outputAmount <= 0}
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                    Starting Production...
                  </>
                ) : (
                  "Start Production"
                )}
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
