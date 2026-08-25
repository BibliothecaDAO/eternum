import type { TokenMetadataAttribute } from "@/types/ark";
// Assuming you're using a tooltip library
import { Button } from "@/components/ui/button";
import { ResourceIcon } from "@/components/ui/resource-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";

/** Max visible resource icons on desktop */
const VISIBLE_RESOURCES_DESKTOP = 4;
/** Max visible resource icons on mobile */
const VISIBLE_RESOURCES_MOBILE = 2;

export default function RealmResources({
  traits,
}: {
  traits: TokenMetadataAttribute[];
}) {
  const resources = traits.filter((trait) => trait.trait_type === "Resource");
  const isMobile = useIsMobile();
  const visibleCount = isMobile ? VISIBLE_RESOURCES_MOBILE : VISIBLE_RESOURCES_DESKTOP;
  const hiddenCount = resources.length - visibleCount;

  return (
    <div className="flex items-center gap-2">
      {resources.slice(0, visibleCount).map((resource, index) => (
        <div
          key={index}
          className="bg-secondary flex items-center gap-2 rounded-lg p-2"
        >
          {resource.value && (
            <ResourceIcon size="md" resource={resource.value.toString()} />
          )}
        </div>
      ))}
      {resources.length > visibleCount && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={"outline"} size={"sm"} className="px-2 pt-1">
                  {`+(${hiddenCount})`}
                </Button>
              </TooltipTrigger>

              <TooltipContent
                className="h-16 max-w-48 p-2"
                id="resource-tooltip"
                side="top"
              >
                <div className="flex items-center gap-2">
                  {resources.slice(visibleCount).map((resource, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div>
                        <span className="text-xs">{resource.value}</span>
                        {resource.value && (
                          <ResourceIcon
                            size="md"
                            withTooltip={false}
                            resource={resource.value.toString()}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </>
      )}
    </div>
  );
}
