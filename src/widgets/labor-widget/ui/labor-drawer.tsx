import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/shared/ui/drawer";
import { Input } from "@/shared/ui/input";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { resources } from "@bibliothecadao/eternum";
import { useState } from "react";
import { LaborBuildingProps } from "../model/types";

interface LaborDrawerProps extends Omit<LaborBuildingProps, "building"> {
  building: LaborBuildingProps["building"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
  const outputResource = resources.find((r) => r.id === building.resourceId);

  if (!outputResource) return null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const renderResourceRow = (resourceId: number, amount: number) => {
    const resource = resources.find((r) => r.id === resourceId);
    const balance = resourceBalances.find((b) => b.resourceId === resourceId)?.balance || 0;

    if (!resource) return null;

    return (
      <div key={resourceId} className="flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2">
          <ResourceIcon resourceId={resource.id} size={24} showTooltip />
          <span>{resource.trait}</span>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" value={amount} className="w-24" readOnly />
          <span className="text-sm text-muted-foreground">Balance: {balance}</span>
        </div>
      </div>
    );
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Manage Production</DrawerTitle>
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
              {building.laborInputs.map((input) => renderResourceRow(input.resourceId, input.amount))}
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ResourceIcon resourceId={outputResource.id} size={24} showTooltip />
                  <span>{outputResource.trait}</span>
                </div>
                <span>{building.outputAmount}</span>
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
                            <span>{input.amount}</span>
                          </div>
                        ) : null;
                      })
                    : building.laborInputs.map((input) => {
                        const resource = resources.find((r) => r.id === input.resourceId);
                        return resource ? (
                          <div key={input.resourceId} className="flex items-center gap-1">
                            <ResourceIcon resourceId={resource.id} size={16} />
                            <span>{input.amount}</span>
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
              <Button className="w-full" onClick={() => onStartProduction(building.id, activeTab)}>
                Start Production
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
