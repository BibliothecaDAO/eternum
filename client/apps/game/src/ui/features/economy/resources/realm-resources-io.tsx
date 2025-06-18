import { ResourceIcon } from "@/ui/elements/resource-icon";
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds } from "@bibliothecadao/types";

export const RealmResourcesIO = ({
  resourcesProduced,
  className,
  titleClassName,
  size = "xs",
  compact = false,
}: {
  resourcesProduced: number[];
  className?: string;
  titleClassName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  compact?: boolean;
}) => {
  const resourcesInputs = configManager.complexSystemResourceInputs;

  const resourcesConsumed = [
    ...new Set(
      resourcesProduced.flatMap((resourceId) => {
        return resourcesInputs[resourceId]
          .filter((input) => input.resource !== ResourcesIds["Wheat"] && input.resource !== ResourcesIds["Fish"])
          .map((input) => input.resource);
      }),
    ),
  ];

  return (
    <div className={`${className}`}>
      {compact ? (
        // Compact view for smaller spaces
        <div className="flex justify-between gap-3">
          <div className="flex flex-col">
            <div className={`text-xs text-gold/80 uppercase font-semibold mb-1 ${titleClassName}`}>Produces</div>
            <div className="flex flex-wrap gap-1">
              {resourcesProduced.map((resourceId) => (
                <ResourceIcon
                  resource={ResourcesIds[resourceId]}
                  size={size}
                  key={resourceId}
                  withTooltip
                  tooltipText={ResourcesIds[resourceId]}
                  className="hover:scale-110 transition-transform"
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            <div className={`text-xs text-gold/80 uppercase font-semibold mb-1 ${titleClassName}`}>Consumes</div>
            <div className="flex flex-wrap gap-1">
              {resourcesConsumed.length > 0 ? (
                resourcesConsumed.map((resourceId) => (
                  <ResourceIcon
                    resource={ResourcesIds[resourceId]}
                    size={size}
                    key={resourceId}
                    withTooltip
                    tooltipText={ResourcesIds[resourceId]}
                    className="hover:scale-110 transition-transform"
                  />
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">None</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Expanded view for detailed display
        <>
          <div className="p-2 rounded-sm bg-gold/5 border-l-4 border-gold/50 mb-3">
            <div className={`text-xs text-gold/90 uppercase font-semibold mb-2 ${titleClassName}`}>Produces</div>
            <div className="flex flex-wrap gap-2">
              {resourcesProduced.map((resourceId) => (
                <div key={resourceId} className="flex flex-col items-center">
                  <ResourceIcon
                    resource={ResourcesIds[resourceId]}
                    size={size === "xs" ? "sm" : size}
                    withTooltip
                    tooltipText={ResourcesIds[resourceId]}
                    className="hover:scale-110 transition-transform"
                  />
                  <span className="text-xs mt-1">{ResourcesIds[resourceId]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-2 rounded-sm bg-gold/5 border-l-4 border-gold/30">
            <div className={`text-xs text-gold/90 uppercase font-semibold mb-2 ${titleClassName}`}>Consumes</div>
            <div className="flex flex-wrap gap-2">
              {resourcesConsumed.length > 0 ? (
                resourcesConsumed.map((resourceId) => (
                  <div key={resourceId} className="flex flex-col items-center">
                    <ResourceIcon
                      resource={ResourcesIds[resourceId]}
                      size={size === "xs" ? "sm" : size}
                      withTooltip
                      tooltipText={ResourcesIds[resourceId]}
                      className="hover:scale-110 transition-transform"
                    />
                    <span className="text-xs mt-1">{ResourcesIds[resourceId]}</span>
                  </div>
                ))
              ) : (
                <span className="text-xs text-gray-400 italic">No resources consumed</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
