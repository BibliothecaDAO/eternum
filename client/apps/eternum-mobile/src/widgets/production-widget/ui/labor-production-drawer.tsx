import { getBlockTimestamp } from "@/shared/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { NumericInput } from "@/shared/ui/numeric-input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ResourceSelectDrawer } from "@/shared/ui/resource-select-drawer";
import {
  configManager,
  divideByPrecision,
  formatTime,
  getIsBlitz,
  multiplyByPrecision,
  TileManager,
} from "@bibliothecadao/eternum";
import { useDojo, useResourceManager } from "@bibliothecadao/react";
import { findResourceById, RealmInfo, ResourcesIds, StructureType } from "@bibliothecadao/types";
import { ChevronDownIcon, Loader2Icon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface LaborDrawerProps {
  realm: RealmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  building?: {
    innerCol: number;
    innerRow: number;
    paused: boolean;
  };
}

export const LaborProductionDrawer = ({ realm, open, onOpenChange, building }: LaborDrawerProps) => {
  const {
    setup: {
      account: { account },
      systemCalls: { burn_resource_for_labor_production },
      components,
      systemCalls,
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [isPauseLoading, setIsPauseLoading] = useState(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedResources, setSelectedResources] = useState<{ id: number; amount: number }[]>([]);
  const resourceManager = useResourceManager(realm.entityId);
  const isBlitz = getIsBlitz();

  useEffect(() => {
    if (building) {
      setIsPaused(building.paused);
    }
  }, [building?.paused]);

  const handleProduce = async () => {
    setIsLoading(true);

    const calldata = {
      entity_id: realm.entityId,
      resource_types: selectedResources.map((r) => r.id),
      resource_amounts: selectedResources.map((r) => multiplyByPrecision(r.amount)),
      signer: account,
    };

    try {
      await burn_resource_for_labor_production(calldata);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseResumeProduction = useCallback(async () => {
    if (!building) return;

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
  }, [components, systemCalls, realm.position, account, realm.entityId, building, isPaused]);

  const laborConfig = useMemo(() => {
    return selectedResources.map((r) => configManager.getLaborConfig(r.id));
  }, [selectedResources]);

  const { laborAmount, ticks } = useMemo(() => {
    if (!laborConfig.length) return { laborAmount: 0, ticks: 0 };

    // Calculate total labor amount based on resource amounts and their labor production rates
    const totalLaborAmount = selectedResources.reduce((acc, resource, index) => {
      const config = laborConfig[index];
      if (!config) return acc;
      const laborForResource = resource.amount * config.laborProductionPerResource;
      return acc + laborForResource;
    }, 0);

    // Calculate ticks based on labor rate per tick
    const ticksPerResource = laborConfig.map((config, index) => {
      if (!config) return 0;
      const resourceAmount = selectedResources[index].amount;
      const laborAmount = resourceAmount * config.laborProductionPerResource;
      return Math.ceil(laborAmount / config.laborRatePerTick);
    });

    const maxTicks = Math.max(...ticksPerResource);

    return { laborAmount: Math.floor(totalLaborAmount), ticks: maxTicks };
  }, [laborConfig, selectedResources]);

  const availableResources = useMemo(() => {
    const { currentBlockTimestamp } = getBlockTimestamp();
    return selectedResources.map((resource) => {
      const resourceBalance = resourceManager.balanceWithProduction(currentBlockTimestamp, resource.id);
      return {
        resourceId: resource.id,
        amount: resourceBalance,
      };
    });
  }, [selectedResources, resourceManager]);

  const addResource = () => {
    const availableResourceIds = Object.values(ResourcesIds).filter(
      (id) => typeof id === "number" && !selectedResources.map((r) => r.id).includes(id as number),
    );
    if (availableResourceIds.length > 0) {
      setSelectedResources([...selectedResources, { id: availableResourceIds[0] as number, amount: 0 }]);
    }
  };

  const removeResource = (index: number) => {
    setSelectedResources(selectedResources.filter((_, i) => i !== index));
  };

  const handleInputChange = (resourceId: ResourcesIds, value: number) => {
    const resourceIndex = selectedResources.findIndex((r) => r.id === resourceId);
    if (resourceIndex === -1) return;

    const newResources = [...selectedResources];
    newResources[resourceIndex].amount = value;
    setSelectedResources(newResources);
  };

  const handleMaxInput = (resourceId: ResourcesIds) => {
    const resourceIndex = selectedResources.findIndex((r) => r.id === resourceId);
    if (resourceIndex === -1) return;

    const balance = divideByPrecision(Number(availableResources[resourceIndex]?.amount || 0));
    const newResources = [...selectedResources];
    newResources[resourceIndex].amount = balance;
    setSelectedResources(newResources);
  };

  const hasInsufficientResources = useMemo(() => {
    return selectedResources.some((resource, index) => {
      const availableAmount = divideByPrecision(Number(availableResources[index]?.amount || 0));
      return resource.amount > availableAmount;
    });
  }, [selectedResources, availableResources]);

  const handleResourceChange = (index: number, resourceId: number) => {
    const newResources = [...selectedResources];
    newResources[index] = { ...newResources[index], id: resourceId, amount: 0 };
    setSelectedResources(newResources);
  };

  const renderProductionRate = () => {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-md">
          <span className="text-sm text-muted-foreground">Resource Type:</span>
          <div className="flex items-center gap-2">
            <ResourceIcon resourceId={ResourcesIds.Labor} size={20} showTooltip />
            <span className="font-medium">Labor</span>
          </div>
        </div>
        <div className="flex items-center justify-center p-4 bg-primary/10 rounded-md">
          <span className="text-sm text-center text-muted-foreground">
            Labor produces automatically in Blitz mode. Use the controls below to pause/resume or destroy the building.
          </span>
        </div>
      </div>
    );
  };

  const renderResourceRow = (resource: { id: number; amount: number }, index: number) => {
    const resourceInfo = findResourceById(resource.id);
    const balance = divideByPrecision(
      Number(availableResources.find((r) => r.resourceId === resource.id)?.amount || 0),
    );

    if (!resourceInfo) return null;

    return (
      <div key={resource.id} className="grid grid-cols-[1.5fr_1fr_auto_auto] items-center gap-2 py-1.5">
        <ResourceSelectDrawer
          entityId={realm.entityId}
          onResourceSelect={(resourceId) => handleResourceChange(index, resourceId)}
        >
          <Button variant="outline" className="w-full justify-between px-2">
            <div className="flex items-center gap-2 min-w-0">
              <ResourceIcon resourceId={resource.id} size={20} showTooltip />
              <div className="flex flex-col items-start min-w-0">
                <span className="text-sm truncate">{resourceInfo.trait}</span>
                <span className="text-xs text-muted-foreground">Balance: {balance}</span>
              </div>
            </div>
            <ChevronDownIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          </Button>
        </ResourceSelectDrawer>
        <NumericInput
          value={resource.amount}
          onChange={(value) => handleInputChange(resource.id, value)}
          label={`Enter Amount`}
          description={resourceInfo.trait}
        />
        <Button size="sm" onClick={() => handleMaxInput(resource.id)} className="h-10">
          Max
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => removeResource(index)}
          className="h-8 w-8 -mr-2 text-muted-foreground hover:text-destructive"
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-3xl font-bokor">Manage Production</DrawerTitle>
        </DrawerHeader>
        <div className="p-4">
          {isBlitz ? (
            renderProductionRate()
          ) : (
            <div className="space-y-4">
              {selectedResources.map((resource, index) => renderResourceRow(resource, index))}
              <Button onClick={addResource} variant="outline" className="w-full">
                Add Resource
              </Button>
            </div>
          )}

          {!isBlitz && (
            <Card className="mt-6">
              <CardContent className="p-4 space-y-4">
                <div className="text-sm space-y-2">
                  <div>Production Details:</div>
                  <div className="flex items-center gap-2">
                    <ResourceIcon resourceId={ResourcesIds.Labor} size={16} />
                    <span>Total Labor Generated: {laborAmount}</span>
                  </div>
                  <div>Time Required: {formatTime(ticks * (realm.category === StructureType.Village ? 2 : 1))}</div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-6 space-y-3">
            {isBlitz ? (
              building && (
                <Button
                  variant="outline"
                  onClick={handlePauseResumeProduction}
                  disabled={isPauseLoading}
                  className="w-full"
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
              )
            ) : (
              <>
                <Button
                  className="w-full"
                  onClick={handleProduce}
                  disabled={
                    selectedResources.length === 0 ||
                    selectedResources.some((r) => r.amount <= 0) ||
                    hasInsufficientResources ||
                    isLoading
                  }
                >
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      Starting Production...
                    </>
                  ) : hasInsufficientResources ? (
                    "Insufficient Resources"
                  ) : (
                    "Start Production"
                  )}
                </Button>

                {building && (
                  <Button
                    variant="outline"
                    onClick={handlePauseResumeProduction}
                    disabled={isPauseLoading}
                    className="w-full"
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
                )}
              </>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
