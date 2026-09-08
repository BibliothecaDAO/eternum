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
          <div className="flex flex-wrap gap-2">
            {group.buildings.map((building) => (
              <button
                key={building.type}
                type="button"
                disabled={building.disabled}
                onClick={() => void form.build(building.type)}
                className="rounded border border-gold/25 px-2 py-1 text-left text-xs disabled:opacity-50"
              >
                <span className="block font-semibold">{building.label}</span>
                <span className="block">{building.cost}</span>
                {building.reason && <span className="block">{building.reason}</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
