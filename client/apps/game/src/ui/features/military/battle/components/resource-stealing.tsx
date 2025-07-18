import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { resources } from "@bibliothecadao/types";
import { Coins, Package } from "lucide-react";

interface ResourceStealingProps {
  stealableResources: Array<{ resourceId: number; amount: number }>;
  className?: string;
}

export const ResourceStealing = ({ stealableResources, className = "" }: ResourceStealingProps) => {
  if (stealableResources.length === 0) {
    return null;
  }

  const totalValue = stealableResources.reduce((sum, resource) => sum + resource.amount, 0);

  return (
    <div className={`p-3 sm:p-4 border border-gold/20 rounded-lg bg-brown-900/30 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-gold flex-shrink-0" />
          <h4 className="text-base sm:text-lg font-semibold text-gold">Resources You Will Steal</h4>
        </div>
        <div className="flex items-center gap-1 text-sm text-gold/70 sm:ml-auto">
          <Package className="w-4 h-4 flex-shrink-0" />
          <span>{stealableResources.length} types</span>
        </div>
      </div>

      {/* Resource Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 max-h-64 overflow-y-auto">
        {stealableResources.map((resource) => {
          const resourceData = resources.find((r) => r.id === resource.resourceId);
          return (
            <div
              key={resource.resourceId}
              className="flex items-center gap-2 p-2 sm:p-3 border border-gold/10 rounded-lg bg-brown-900/50 hover:bg-brown-900/70 transition-colors"
            >
              <ResourceIcon
                resource={resourceData?.trait || ""}
                size="sm"
                className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-medium text-gold truncate">
                  {resourceData?.trait || "Unknown"}
                </div>
                <div className="text-sm sm:text-lg font-bold text-gold">{resource.amount.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gold/20">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gold/70">Total Items</span>
          <span className="text-lg font-bold text-gold">{totalValue.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
};
