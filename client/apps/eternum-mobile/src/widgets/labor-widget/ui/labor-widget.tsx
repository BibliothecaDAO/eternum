import { useBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import { currencyFormat } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import {
  configManager,
  divideByPrecision,
  findResourceById,
  formatTime,
  ID,
  resources,
  ResourcesIds,
  TickIds,
  TimeFormat,
} from "@bibliothecadao/eternum";
import { Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LaborBuildingProps } from "../model/types";
import { LaborDrawer } from "./labor-drawer";

export const LaborWidget = ({ building, resourceManager, realm }: LaborBuildingProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showPerHour, setShowPerHour] = useState(true);
  const [balance, setBalance] = useState(0);
  const resource = resources.find((r) => r.id === building.produced.resource);
  const { currentDefaultTick: currentTick } = useBlockTimestamp();

  if (!resource) return null;

  const getBalance = useCallback(() => {
    return resourceManager.balanceWithProduction(currentTick, building.produced.resource);
  }, [resourceManager, currentTick, building.produced.resource]);

  const production = useMemo(() => {
    const balance = getBalance();
    setBalance(balance);
    return resourceManager.getProduction(building.produced.resource);
  }, [getBalance, resourceManager, building.produced.resource]);

  const maxAmountStorable = useMemo(() => {
    const resourceWeight = configManager.getResourceWeightKg(building.produced.resource as ID) || 1000;
    return realm.capacity! / resourceWeight;
  }, [building.produced.resource]);

  const timeUntilValueReached = useMemo(() => {
    return resourceManager.timeUntilValueReached(currentTick, building.produced.resource);
  }, [resourceManager, currentTick, building.produced.resource]);

  const productionEndsAt = useMemo(() => {
    return resourceManager.getProductionEndsAt(building.produced.resource);
  }, [resourceManager, building.produced.resource]);

  const isActive = useMemo(() => {
    return resourceManager.isActive(building.produced.resource);
  }, [resourceManager, building.produced.resource]);

  const reachedMaxCap = useMemo(() => {
    return maxAmountStorable === balance && isActive;
  }, [maxAmountStorable, balance, isActive]);

  useEffect(() => {
    const tickTime = configManager.getTick(TickIds.Default) * 1000;
    let realTick = currentTick;

    const newBalance = resourceManager.balanceWithProduction(realTick, building.produced.resource);
    setBalance(newBalance);

    if (isActive) {
      const interval = setInterval(() => {
        realTick += 1;
        const newBalance = resourceManager.balanceWithProduction(realTick, building.produced.resource);
        if (building.produced.resource === ResourcesIds.Wheat) {
          console.log(findResourceById(building.produced.resource)?.trait);
          console.log("newBalance", currencyFormat(newBalance, 2));
        }
        setBalance(newBalance);
      }, tickTime);
      return () => clearInterval(interval);
    }
  }, [resourceManager, currentTick, isActive, building.produced.resource]);

  const productionRate = Number(divideByPrecision(Number(production?.production_rate || 0), false));
  const productionPerHour = (productionRate * 60 * 60).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const productionPerSec = productionRate.toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex flex-col gap-2">
            {/* Main info row */}
            <div className="flex items-start justify-between">
              {/* Left column with resource info */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">{resource.trait}</span>
                  <span className="text-xs text-white/90 px-1.5 py-0.5 rounded-md bg-white/10">
                    {currencyFormat(balance, 2)}
                  </span>
                </div>
                {isActive ? (
                  <div className="flex items-center gap-1">
                    <span className={`text-xs ${productionRate > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      +{showPerHour ? `${productionPerHour}/h` : `${productionPerSec}/s`}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1.5 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
                      onClick={() => setShowPerHour(!showPerHour)}
                    >
                      {showPerHour ? "per hour" : "per sec"}
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-white/50">
                    {reachedMaxCap ? "Production stopped (Max Cap)" : "Production stopped (No Labor)"}
                  </div>
                )}
              </div>

              {/* Resource icon */}
              <ResourceIcon resourceId={resource.id} size={40} showTooltip />
            </div>

            {/* Bottom row with time and settings */}
            <div className="flex items-center justify-between">
              {timeUntilValueReached !== 0 && (
                <Badge variant="secondary" className="h-6 text-xs bg-white/10 text-white/90">
                  {formatTime(timeUntilValueReached, TimeFormat.D | TimeFormat.H | TimeFormat.M)}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-auto text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => setIsDrawerOpen(true)}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LaborDrawer building={building} open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
};
