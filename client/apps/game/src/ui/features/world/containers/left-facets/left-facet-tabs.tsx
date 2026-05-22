import { useUIStore, type LeftFacet } from "@/hooks/store/use-ui-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HUD_LABEL } from "@/ui/design-system/atoms/hud-typography";
import { OVERLAY_SURFACE_ACTIVE, OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import type { LucideIcon } from "lucide-react";
import Coins from "lucide-react/dist/esm/icons/coins";
import Crown from "lucide-react/dist/esm/icons/crown";
import Shield from "lucide-react/dist/esm/icons/shield";
import { memo } from "react";

interface FacetTabDescriptor {
  id: LeftFacet;
  label: string;
  icon: LucideIcon;
}

const FACET_TABS: FacetTabDescriptor[] = [
  { id: "overview", label: "Overview", icon: Crown },
  { id: "economy", label: "Economy", icon: Coins },
  { id: "military", label: "Military", icon: Shield },
];

interface LeftFacetTabsProps {
  /** Per-tab attention flags — render a small gold dot when true. */
  attention?: Partial<Record<LeftFacet, boolean>>;
}

/**
 * Three-tab segmented control for the left control column. Each facet swaps
 * the bubbles rendered below the picker pill, so the column acts as a control
 * surface (not a duplicate of the right-side read-only inspector).
 */
export const LeftFacetTabs = memo(({ attention }: LeftFacetTabsProps) => {
  const leftFacet = useUIStore((state) => state.leftFacet);
  const setLeftFacet = useUIStore((state) => state.setLeftFacet);

  return (
    <div className={cn("pointer-events-auto flex items-stretch gap-1 rounded-xl p-1", OVERLAY_SURFACE_BASE)}>
      {FACET_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = leftFacet === tab.id;
        const hasAttention = Boolean(attention?.[tab.id]);
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setLeftFacet(tab.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 transition",
              isActive
                ? cn(OVERLAY_SURFACE_ACTIVE, "border-gold/60")
                : "border-gold/15 bg-black/20 hover:border-gold/30 hover:bg-black/30",
            )}
            title={tab.label}
            aria-pressed={isActive}
          >
            <Icon className={cn("h-3.5 w-3.5", isActive ? "text-gold" : "text-gold/60")} />
            <span className={cn(HUD_LABEL, isActive && "text-gold")}>{tab.label}</span>
            {hasAttention && (
              <span
                className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-gold shadow-[0_0_6px_rgba(223,170,84,0.7)]"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
});

LeftFacetTabs.displayName = "LeftFacetTabs";
