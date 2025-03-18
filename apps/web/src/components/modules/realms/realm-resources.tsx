import { ResourceIcon } from "@/components/ui/resource-icon";
import type { TokenMetadataAttribute } from "@/types/ark";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Assuming you're using a tooltip library
import { Button } from "@/components/ui/button";

export default function RealmResources({
  traits,
}: {
  traits: TokenMetadataAttribute[];
}) {
  const resources = traits.filter((trait) => trait.trait_type === "Resource");
  const hiddenCount = resources.length - 4;

  return (
    <div className="flex items-center gap-2">
      {resources.slice(0, 4).map((resource, index) => (
        <div
          key={index}
          className="flex items-center gap-2 rounded-lg bg-secondary p-2"
        >
          {resource.value && (
            <ResourceIcon size="md" resource={resource.value} />
          )}
        </div>
      ))}
      {resources.length > 4 && (
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
                  {resources.slice(4).map((resource, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div>
                        <span className="text-xs">{resource.value}</span>
                        {resource.value && (
                          <ResourceIcon
                            size="md"
                            withTooltip={false}
                            resource={resource.value}
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
