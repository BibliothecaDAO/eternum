import { resourceMeaning } from "@/ui/design-system/icon-meaning";
import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { BuildingThumbnail } from "./building-thumbnail";
import { ResourcesIds } from "@bibliothecadao/types";
import { useEffect } from "react";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { HudCard, HudNotice, HudPanel, HudSwitch } from "@/ui/design-system/kit/hud-elements";
import { RequirementChips } from "@/ui/design-system/molecules/requirement-chips";
import { usePlotConstruction, type PlotConstructionTarget } from "./use-plot-construction";

/** A choice's cost, each resource painted with its amount, as the Build window's cards name theirs. */
const PaintedCost = ({ requirements }: { requirements: { resource: ResourcesIds; amount: number }[] | undefined }) => (
  <span className="flex flex-wrap gap-x-2 gap-y-1 tabular-nums">
    {requirements === undefined && "—"}
    {requirements?.map((cost) => (
      <span key={cost.resource} className="inline-flex items-center gap-0.5" title={ResourcesIds[cost.resource]}>
        <SemanticIcon name={resourceMeaning(cost.resource)} alt={ResourcesIds[cost.resource]} className="h-4 w-4" />
        {cost.amount.toLocaleString()}
      </span>
    ))}
  </span>
);

export function PlotConstructionPicker(target: PlotConstructionTarget) {
  const form = usePlotConstruction(target);
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  useEffect(() => {
    if (!form.visible) usePopoverStore.getState().close("plot-construction");
  }, [form.visible]);
  if (!form.visible) return null;
  return (
    <div className="ui flex w-96 max-w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-hud-title">Build on this plot</span>
        {form.allowSimpleCost && (
          <span className="flex items-center gap-2 text-hud-label">
            Simple cost
            <HudSwitch on={form.useSimpleCost} label="Simple cost" onChange={form.setUseSimpleCost} />
          </span>
        )}
      </div>
      {form.error && <HudNotice tone="bad" line={form.error} />}
      {form.groups.map((group) => (
        <HudPanel key={group.label} kind="section" title={group.label} label={group.label} collapsible={false}>
          <div className="grid grid-cols-3 gap-2">
            {group.buildings
              .toSorted((a, b) => Number(a.disabled) - Number(b.disabled))
              .map((building) => (
                // A blocked choice still answers hover with what it holds against what it needs.
                <div
                  key={building.type}
                  onMouseEnter={() =>
                    setTooltip({ content: <RequirementChips requirements={building.requirements} />, position: "top" })
                  }
                  onMouseLeave={() => setTooltip(null)}
                >
                  <HudCard
                    title={building.label}
                    picture={<BuildingThumbnail building={building.type} alt="" />}
                    detail={<PaintedCost requirements={building.requirements} />}
                    disabled={building.disabled}
                    refusal={building.reason}
                    onClick={() => void form.build(building.type)}
                  />
                </div>
              ))}
          </div>
        </HudPanel>
      ))}
    </div>
  );
}
