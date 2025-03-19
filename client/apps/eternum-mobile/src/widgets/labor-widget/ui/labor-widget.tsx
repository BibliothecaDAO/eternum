import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { resources } from "@bibliothecadao/eternum";
import { Settings2 } from "lucide-react";
import { useState } from "react";
import { LaborBuildingProps } from "../model/types";
import { LaborDrawer } from "./labor-drawer";

export const LaborWidget = ({ building }: LaborBuildingProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const resource = resources.find((r) => r.id === building.produced.resource);

  if (!resource) return null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ResourceIcon resourceId={resource.id} size={32} showTooltip />
              <div className="flex flex-col">
                <span className="font-semibold">{resource.trait}</span>
                <span className="text-sm text-muted-foreground">Output: {building.produced.amount}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {building.isActive && <Badge variant="secondary">{formatTime(building.productionTimeLeft)}</Badge>}
              <Button variant="ghost" size="icon" onClick={() => setIsDrawerOpen(true)}>
                <Settings2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <LaborDrawer building={building} open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
};
