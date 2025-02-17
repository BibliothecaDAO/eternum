import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { ResourcesIds, resources } from "@bibliothecadao/eternum";
import { useState } from "react";
import { LaborBuildingProps } from "../model/types";

interface LaborDrawerProps extends Omit<LaborBuildingProps, "building"> {
  building: LaborBuildingProps["building"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ResourceAmounts = {
  [key in ResourcesIds]?: number;
};

export const LaborDrawer = ({
  building,
  resourceBalances,
  onStartProduction,
  onPauseProduction,
  onExtendProduction,
  open,
  onOpenChange,
}: LaborDrawerProps) => {
  const [activeTab, setActiveTab] = useState<"raw" | "labor">("raw");
  const [outputAmount, setOutputAmount] = useState(building.outputAmount);
  const [inputAmounts, setInputAmounts] = useState<ResourceAmounts>(
    building.inputs.reduce((acc, input) => ({ ...acc, [input.resourceId]: input.amount }), {}),
  );
  const [laborInputAmounts, setLaborInputAmounts] = useState<ResourceAmounts>(
    building.laborInputs.reduce((acc, input) => ({ ...acc, [input.resourceId]: input.amount }), {}),
  );
  const outputResource = resources.find((r) => r.id === building.resourceId);

  if (!outputResource) return null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const handleInputChange = (resourceId: ResourcesIds, value: string, isLabor: boolean = false) => {
    const numValue = parseInt(value) || 0;
    if (isLabor) {
      setLaborInputAmounts((prev) => ({ ...prev, [resourceId]: numValue }));
    } else {
      setInputAmounts((prev) => ({ ...prev, [resourceId]: numValue }));
    }
  };

  const handleOutputChange = (value: string) => {
    const numValue = parseInt(value) || 0;
    setOutputAmount(numValue);
    // Here you would typically recalculate input amounts based on the new output
    // For now, we'll just scale them proportionally
    const scale = numValue / building.outputAmount;
    if (activeTab === "raw") {
      setInputAmounts(
        (prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([key, value]) => [key, Math.ceil(Number(value) * scale)]),
          ) as ResourceAmounts,
      );
    } else {
      setLaborInputAmounts(
        (prev) =>
          Object.fromEntries(
            Object.entries(prev).map(([key, value]) => [key, Math.ceil(Number(value) * scale)]),
          ) as ResourceAmounts,
      );
    }
  };

  const renderResourceRow = (resourceId: ResourcesIds, amount: number, isLabor: boolean = false) => {
    const resource = resources.find((r) => r.id === resourceId);
    const balance = resourceBalances.find((b) => b.resourceId === resourceId)?.balance || 0;

    if (!resource) return null;

    return (
      <div key={resourceId} className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 items-center">
        <div className="flex items-center gap-2">
          <ResourceIcon resourceId={resource.id} size={24} showTooltip />
          <span>{resource.trait}</span>
        </div>
        <Input
          type="number"
          value={isLabor ? (laborInputAmounts[resourceId] ?? amount) : (inputAmounts[resourceId] ?? amount)}
          onChange={(e) => handleInputChange(resourceId, e.target.value, isLabor)}
          className="w-24"
          min={0}
        />
        <span className="text-sm text-muted-foreground whitespace-nowrap">Balance: {balance}</span>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "raw" | "labor")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="raw">Raw Mode</TabsTrigger>
              <TabsTrigger value="labor">Labor Mode</TabsTrigger>
            </TabsList>
            <TabsContent value="raw" className="mt-4 space-y-4">
              {building.inputs.map((input) => renderResourceRow(input.resourceId, input.amount))}
            </TabsContent>
            <TabsContent value="labor" className="mt-4 space-y-4">
              {building.laborInputs.map((input) => renderResourceRow(input.resourceId, input.amount, true))}
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-[1fr_auto] gap-4 items-center">
                <div className="flex items-center gap-2">
                  <ResourceIcon resourceId={outputResource.id} size={24} showTooltip />
                  <span>{outputResource.trait}</span>
                </div>
                <Input
                  type="number"
                  value={outputAmount}
                  onChange={(e) => handleOutputChange(e.target.value)}
                  className="w-24"
                  min={0}
                />
              </div>

              <div className="text-sm">
                <div>Consumed per second:</div>
                <div className="flex gap-2 mt-1">
                  {activeTab === "raw"
                    ? building.inputs.map((input) => {
                        const resource = resources.find((r) => r.id === input.resourceId);
                        return resource ? (
                          <div key={input.resourceId} className="flex items-center gap-1">
                            <ResourceIcon resourceId={resource.id} size={16} />
                            <span>{inputAmounts[input.resourceId] ?? input.amount}</span>
                          </div>
                        ) : null;
                      })
                    : building.laborInputs.map((input) => {
                        const resource = resources.find((r) => r.id === input.resourceId);
                        return resource ? (
                          <div key={input.resourceId} className="flex items-center gap-1">
                            <ResourceIcon resourceId={resource.id} size={16} />
                            <span>{laborInputAmounts[input.resourceId] ?? input.amount}</span>
                          </div>
                        ) : null;
                      })}
                </div>
              </div>

              {building.isActive && <div>Production time left: {formatTime(building.productionTimeLeft)}</div>}
            </CardContent>
          </Card>

          <div className="mt-6 flex gap-2">
            {building.isActive ? (
              <>
                <Button className="flex-1" onClick={() => onExtendProduction(building.id, activeTab)}>
                  Extend
                </Button>
                <Button variant="destructive" onClick={() => onPauseProduction(building.id)}>
                  Pause
                </Button>
              </>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  const updatedBuilding = {
                    ...building,
                    outputAmount,
                    inputs: building.inputs.map((input) => ({
                      ...input,
                      amount: inputAmounts[input.resourceId] ?? input.amount,
                    })),
                    laborInputs: building.laborInputs.map((input) => ({
                      ...input,
                      amount: laborInputAmounts[input.resourceId] ?? input.amount,
                    })),
                  };
                  onStartProduction(updatedBuilding.id, activeTab);
                }}
              >
                Start Production
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
