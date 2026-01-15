import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { currencyIntlFormat } from "@/ui/utils/utils";
import { divideByPrecision, ResourceManager } from "@bibliothecadao/eternum";
import { ClientComponents, ResourcesIds } from "@bibliothecadao/types";
import { ComponentValue } from "@dojoengine/recs";

interface ActiveResourceProductionsProps {
  resources: ComponentValue<ClientComponents["Resource"]["schema"]> | null;
  size?: "xs" | "sm" | "md";
  compact?: boolean;
}

export const ActiveResourceProductions = ({
  resources,
  size = "xs",
  compact = false,
}: ActiveResourceProductionsProps) => {
  if (!resources) return null;

  const activeProductions = ResourceManager.getActiveProductions(resources);

  if (activeProductions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {activeProductions.map(({ resourceId, productionRate }) => {
        const ratePerSecond = Number(divideByPrecision(Number(productionRate), false));

        return (
          <div key={resourceId} className="flex items-center gap-1 bg-gold/10 rounded px-2 py-1">
            <ResourceIcon
              resource={ResourcesIds[resourceId]}
              size={size}
              withTooltip
              tooltipText={ResourcesIds[resourceId]}
            />
            <span className={`${compact ? "text-xxs" : "text-xs"} text-green`}>
              +{currencyIntlFormat(ratePerSecond, 4)}/s
            </span>
          </div>
        );
      })}
    </div>
  );
};
