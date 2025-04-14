import { cn } from "@/shared/lib/utils";
import { Resources, resources } from "@bibliothecadao/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

export interface ResourceIconProps {
  /**
   * Resource ID from 1 to 31
   */
  resourceId: number;
  /**
   * Optional size in pixels (both width and height)
   * @default 24
   */
  size?: number;
  /**
   * Optional CSS class name for additional styling
   */
  className?: string;
  /**
   * Whether to show the tooltip with resource name and description
   * @default false
   */
  showTooltip?: boolean;
}

/**
 * A component for displaying resource icons with optional tooltip
 */
export const ResourceIcon = ({ resourceId, size = 24, className, showTooltip = false }: ResourceIconProps) => {
  // Get the resource data based on ID
  const resourceData = resources.find((r: Resources) => r.id === resourceId);

  if (!resourceData) {
    console.warn(`Resource with ID ${resourceId} not found`);
    return null;
  }

  const icon = (
    <img
      src={`/images/resources/${resourceData.id}.png`}
      alt={resourceData.trait}
      className={cn("object-contain", className)}
      style={{
        width: size,
        height: size,
      }}
      loading="lazy"
    />
  );

  if (!showTooltip) {
    return icon;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{icon}</TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <div className="font-semibold">{resourceData.trait}</div>
            <div className="text-sm text-muted-foreground">{resourceData.description}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
