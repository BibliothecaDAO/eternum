import { useState, type ReactNode } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { RequirementChips, type ResourceRequirement } from "@/ui/design-system/molecules/requirement-chips";

interface BuildingAction {
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
}

interface CompactBuildingCardProps {
  name: string;
  image: string;
  count: number;
  status?: string;
  requirements: ResourceRequirement[] | undefined;
  disabledReason?: string;
  details: ReactNode;
  active: boolean;
  onPlace?: () => void;
  build: BuildingAction;
  production: BuildingAction & { paused?: boolean };
  destroy: BuildingAction;
}

const ACTION_CLASS =
  "min-h-11 rounded-md border border-gold/30 px-3 text-sm text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:bg-gold/15 disabled:opacity-50";

/** Costs are visible before building; management remains available even when another building is unaffordable. */
export const CompactBuildingCard = ({
  name,
  image,
  count,
  status,
  requirements,
  disabledReason,
  details,
  active,
  onPlace,
  build,
  production,
  destroy,
}: CompactBuildingCardProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  return (
    <article className={cn("min-w-0 rounded-lg border border-gold/20 bg-black/20 p-3", active && "border-gold")}>
      <div className="flex items-center gap-3">
        <img src={image} alt="" className="h-14 w-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-tight text-gold">{name}</h3>
          <p className="text-xs text-gold/75">
            {count} built{status && ` · ${status}`}
          </p>
        </div>
        <button
          type="button"
          className={cn(ACTION_CLASS, "shrink-0 bg-gold text-black")}
          aria-label={`Build ${name}`}
          disabled={build.disabled || build.pending}
          onClick={build.onClick}
        >
          {build.pending ? "Building…" : "Build"}
        </button>
      </div>
      <div className="mt-2 space-y-1">
        <p className="text-xs text-gold/75">Cost · owned / needed</p>
        <RequirementChips requirements={requirements} />
        {disabledReason && <p className="text-sm text-gold/85">{disabledReason}</p>}
      </div>
      <details
        className="mt-2 border-t border-gold/15"
        onToggle={(event) => {
          setDetailsOpen(event.currentTarget.open);
          if (!event.currentTarget.open) setConfirmDestroy(false);
        }}
      >
        <summary className="flex min-h-11 cursor-pointer items-center text-sm text-gold underline underline-offset-4">
          Details & management
        </summary>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {onPlace && (
              <button
                type="button"
                className={ACTION_CLASS}
                disabled={build.disabled || build.pending}
                onClick={onPlace}
              >
                Place on map
              </button>
            )}
            {production.onClick && count > 0 && (
              <button
                type="button"
                className={ACTION_CLASS}
                disabled={production.disabled || production.pending}
                onClick={production.onClick}
              >
                {production.pending ? "Updating…" : production.paused ? "Resume all" : "Pause all"}
              </button>
            )}
            {destroy.onClick && count > 0 && (
              <button
                type="button"
                className={cn(ACTION_CLASS, "border-red-400/50 text-red-300")}
                disabled={destroy.disabled || destroy.pending}
                onClick={() => {
                  if (!confirmDestroy) setConfirmDestroy(true);
                  else {
                    destroy.onClick?.();
                    setConfirmDestroy(false);
                  }
                }}
              >
                {destroy.pending ? "Destroying…" : confirmDestroy ? "Confirm destroy one" : "Destroy one"}
              </button>
            )}
            {confirmDestroy && (
              <button type="button" className={ACTION_CLASS} onClick={() => setConfirmDestroy(false)}>
                Cancel
              </button>
            )}
          </div>
          {detailsOpen && details}
        </div>
      </details>
    </article>
  );
};
