import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { ResourcesIds } from "@bibliothecadao/types";
import { useEffect } from "react";
import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { usePlotConstruction, type PlotConstructionTarget } from "./use-plot-construction";

export function PlotConstructionPicker(target: PlotConstructionTarget) {
  const form = usePlotConstruction(target);
  useEffect(() => {
    if (!form.visible) usePopoverStore.getState().close("plot-construction");
  }, [form.visible]);
  if (!form.visible) return null;
  return (
    <div className="w-[420px] max-w-full space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Build on this plot</span>
        <label className="flex items-center gap-2 text-xs">
          Simple cost
          <input
            type="checkbox"
            role="switch"
            checked={form.useSimpleCost}
            onChange={(event) => form.setUseSimpleCost(event.target.checked)}
          />
        </label>
      </div>
      {form.error && (
        <p role="status" className="text-xs">
          {form.error}
        </p>
      )}
      {form.groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-1 text-xs font-semibold">{group.label}</h3>
          <div className="grid grid-cols-3 gap-2">
            {group.buildings.toSorted((a, b) => Number(a.disabled) - Number(b.disabled)).map((building) => (
              <button
                key={building.type}
                type="button"
                disabled={building.disabled}
                aria-label={building.label}
                title={building.reason ?? building.label}
                onClick={() => void form.build(building.type)}
                className="relative min-w-0 overflow-hidden rounded border border-gold/25 p-1 text-center text-xs"
              >
                <img
                  src={BUILDING_IMAGES_PATH[building.type as keyof typeof BUILDING_IMAGES_PATH]}
                  alt=""
                  className="h-16 w-full object-contain"
                />
                <span className="block font-semibold">{building.label}</span>
                <span className="flex flex-wrap justify-center gap-x-2 gap-y-1 py-1 text-[10px] tabular-nums">
                  {building.costs?.map((cost) => (
                    <span key={cost.resource} className="inline-flex items-center gap-0.5" title={ResourcesIds[cost.resource]}>
                      <img src={`/images/resources/${cost.resource}.png`} alt={ResourcesIds[cost.resource]} className="h-4 w-4" />
                      {cost.amount.toLocaleString()}
                    </span>
                  )) ?? "Cost unavailable"}
                </span>
                {building.disabled && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/50" />}
                {building.reason && <span className="sr-only">{building.reason}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
