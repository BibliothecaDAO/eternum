import { useBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import { cn, currencyFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ID, resources } from "@bibliothecadao/eternum";
import { useResourceManager } from "@bibliothecadao/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface ResourceAmount {
  id: number;
  amount: number;
}

interface ResourcesCardProps {
  className?: string;
  entityId: ID;
}

export const ResourcesCard = ({ className, entityId }: ResourcesCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [resourceAmounts, setResourceAmounts] = useState<ResourceAmount[]>([]);
  const { currentDefaultTick: tick } = useBlockTimestamp();
  const resourceManager = useResourceManager(entityId);

  const updateResourceAmounts = useCallback(() => {
    if (!entityId) return;

    const amounts = resources
      .filter((resource) => resource.id < 23)
      .map((resource) => ({
        id: resource.id,
        amount: resourceManager.balanceWithProduction(tick, resource.id),
      }));

    setResourceAmounts(amounts);
  }, [entityId, resourceManager, tick]);

  useEffect(() => {
    updateResourceAmounts();

    // Update resources periodically
    const interval = setInterval(updateResourceAmounts, 1000);
    return () => clearInterval(interval);
  }, [updateResourceAmounts]);

  if (!entityId) {
    return null;
  }

  return (
    <Card className={cn("w-full p-4", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Resources</h3>
          <CollapsibleTrigger className="rounded-full p-2 hover:bg-accent">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CollapsibleTrigger>
        </div>

        {/* Collapsed view - horizontal scroll */}
        <div className={cn("flex gap-4 overflow-x-auto pb-2", isExpanded && "hidden")}>
          {resourceAmounts.map(({ id, amount }) => {
            const resource = resources.find((r) => r.id === id);
            if (!resource) return null;

            return (
              <div key={resource.id} className="flex flex-col items-center space-y-1 min-w-[32px]">
                <ResourceIcon resourceId={resource.id} className="h-8 w-8" />
                <span className="text-xs font-medium">{currencyFormat(amount)}</span>
              </div>
            );
          })}
        </div>

        {/* Expanded view - vertical list */}
        <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <ScrollArea className="h-[30vh]">
            <div className="space-y-2 px-2">
              {resourceAmounts.map(({ id, amount }) => {
                const resource = resources.find((r) => r.id === id);
                if (!resource) return null;

                return (
                  <div key={resource.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <ResourceIcon resourceId={resource.id} className="h-8 w-8" />
                      <div className="flex flex-col">
                        <span className="font-medium">{resource.trait}</span>
                        <span className="text-sm text-muted-foreground">{currencyFormat(amount)}</span>
                      </div>
                    </div>
                    <Button variant="secondary" size="sm">
                      Trade
                    </Button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
