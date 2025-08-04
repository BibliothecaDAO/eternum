import { useResourceBalances } from "@/features/resource-balances";
import { ROUTES } from "@/shared/consts/routes";
import { cn, currencyFormat, currencyIntlFormat } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/ui/collapsible";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { divideByPrecision, getIsBlitz } from "@bibliothecadao/eternum";
import { getResourceTiers, ID, resources, ResourcesIds } from "@bibliothecadao/types";

import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

interface ResourcesCardProps {
  className?: string;
  entityId: ID;
}

const NORMAL_TIER_ORDER = [
  "lords",
  "labor",
  "transport",
  "food",
  "common",
  "uncommon",
  "rare",
  "unique",
  "mythic",
  "military",
] as const;

const BLITZ_TIER_ORDER = ["lords", "relics", "essence", "labor", "military", "transport", "food", "materials"] as const;

type ResourceTier = (typeof NORMAL_TIER_ORDER | typeof BLITZ_TIER_ORDER)[number];

const HIDDEN_TIERS_IN_COLLAPSED: ResourceTier[] = ["lords", "labor", "military", "transport"];

export const ResourcesCard = ({ className, entityId }: ResourcesCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { resourceAmounts } = useResourceBalances(entityId);
  const navigate = useNavigate();
  const isBlitz = getIsBlitz();
  const RESOURCE_TIERS = getResourceTiers(isBlitz);
  const TIER_ORDER = isBlitz ? BLITZ_TIER_ORDER : NORMAL_TIER_ORDER;

  const handleTradeClick = (resourceId: number) => {
    const amount = resourceAmounts.find((r) => r.id === resourceId)?.amount || 0;
    if (amount > 0) {
      navigate({
        to: ROUTES.TRADE,
        search: { sellResourceId: resourceId, buyResourceId: ResourcesIds.Lords },
      });
    } else {
      navigate({
        to: ROUTES.TRADE,
        search: { sellResourceId: ResourcesIds.Lords, buyResourceId: resourceId },
      });
    }
  };

  const renderResourceItem = useCallback(
    (resourceId: number) => {
      const amount = resourceAmounts.find((r) => r.id === resourceId)?.amount || 0;
      const resource = resources.find((r) => r.id === resourceId);
      if (!resource) return null;

      if (isExpanded) {
        return (
          <div key={resource.id} className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <ResourceIcon resourceId={resource.id} className="h-8 w-8" />
              <div className="flex flex-col">
                <span className="font-medium">{resource.trait}</span>
                <span className="text-sm text-muted-foreground">{currencyFormat(amount)}</span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => handleTradeClick(resource.id)}>
              Trade
            </Button>
          </div>
        );
      }

      return (
        <div key={resource.id} className="flex flex-col items-center space-y-1 min-w-[32px]">
          <ResourceIcon resourceId={resource.id} className="h-8 w-8" />
          <span className="text-xs font-medium">{currencyIntlFormat(divideByPrecision(amount))}</span>
        </div>
      );
    },
    [isExpanded, resourceAmounts],
  );

  const visibleCollapsedResources = useMemo(() => {
    return Object.entries(RESOURCE_TIERS)
      .filter(([tier]) => !HIDDEN_TIERS_IN_COLLAPSED.includes(tier as ResourceTier))
      .flatMap(([_, resourceIds]) => resourceIds);
  }, []);

  const orderedTiers = useMemo(() => {
    return TIER_ORDER.filter((tier): tier is ResourceTier => tier in RESOURCE_TIERS).map(
      (tier) => [tier, RESOURCE_TIERS[tier as keyof typeof RESOURCE_TIERS]] as const,
    );
  }, []);

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
        <div className={cn("flex gap-4 overflow-x-auto pb-2 px-2", isExpanded && "hidden")}>
          {visibleCollapsedResources.map((resourceId) => renderResourceItem(resourceId))}
        </div>

        {/* Expanded view - vertical list with tiers */}
        <CollapsibleContent className="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
          <ScrollArea className="h-[50vh]">
            <div className="space-y-6 px-2">
              {orderedTiers.map(([tier, resourceIds]) => (
                <div key={tier} className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground sticky top-0 bg-background/95 backdrop-blur-sm py-2 capitalize">
                    {tier}
                  </h4>
                  <div className="space-y-2">
                    {resourceIds.map((resourceId: ResourcesIds) => renderResourceItem(resourceId))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
