import { HUD_LABEL_BRIGHT } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Mountain, Portal } from "@/ui/design-system/atoms/game-icons";
import { TOP_PILL } from "./top-pill";

interface MapViewControlsProps {
  compact: boolean;
  isLocalView: boolean;
  mapLayer: boolean;
  showLayerSwitch: boolean;
  onNavigate: (world: boolean) => void;
  onLayerChange: (alt: boolean) => void;
}

/** Primary map navigation, with one space-saving layer toggle in the mobile HUD. */
export function MapViewControls({
  compact,
  isLocalView,
  mapLayer,
  showLayerSwitch,
  onNavigate,
  onLayerChange,
}: MapViewControlsProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <MapViewSwitch compact={compact} isLocalView={isLocalView} onNavigate={onNavigate} />
      {showLayerSwitch &&
        (compact ? (
          <CompactLayerSwitch mapLayer={mapLayer} onLayerChange={onLayerChange} />
        ) : (
          <LayerSwitch mapLayer={mapLayer} onLayerChange={onLayerChange} />
        ))}
    </div>
  );
}

const MapViewSwitch = ({
  compact,
  isLocalView,
  onNavigate,
}: {
  compact: boolean;
  isLocalView: boolean;
  onNavigate: (world: boolean) => void;
}) => (
  <div role="group" aria-label="Map view" className={cn(TOP_PILL, "gap-0.5 px-1 max-lg:h-auto")}>
    <button
      type="button"
      aria-pressed={isLocalView}
      onClick={() => onNavigate(false)}
      className={viewButtonClasses(isLocalView, compact)}
    >
      Local
    </button>
    <button
      type="button"
      aria-pressed={!isLocalView}
      onClick={() => onNavigate(true)}
      className={viewButtonClasses(!isLocalView, compact)}
    >
      World
    </button>
  </div>
);

const CompactLayerSwitch = ({
  mapLayer,
  onLayerChange,
}: {
  mapLayer: boolean;
  onLayerChange: (alt: boolean) => void;
}) => {
  const currentLayer = mapLayer ? "Ethereal" : "Surface";
  const nextLayer = mapLayer ? "Surface" : "Ethereal";
  const Icon = mapLayer ? Portal : Mountain;

  return (
    <div role="group" aria-label="Map layer" className={cn(TOP_PILL, "px-1 max-lg:h-auto")}>
      <button
        type="button"
        aria-label={`Map layer: ${currentLayer}. Switch to ${nextLayer}`}
        title={`Switch to ${nextLayer}`}
        onClick={() => onLayerChange(!mapLayer)}
        className={layerButtonClasses(true, true)}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {currentLayer}
      </button>
    </div>
  );
};

const LayerSwitch = ({ mapLayer, onLayerChange }: { mapLayer: boolean; onLayerChange: (alt: boolean) => void }) => (
  <div role="group" aria-label="Map layer" className={cn(TOP_PILL, "gap-0.5 px-1 max-lg:h-auto")}>
    <button
      type="button"
      aria-pressed={!mapLayer}
      onClick={() => onLayerChange(false)}
      className={layerButtonClasses(!mapLayer)}
    >
      <Mountain className="h-3.5 w-3.5" aria-hidden />
      Surface
    </button>
    <button
      type="button"
      aria-pressed={mapLayer}
      onClick={() => onLayerChange(true)}
      className={layerButtonClasses(mapLayer)}
    >
      <Portal className="h-3.5 w-3.5" aria-hidden />
      Ethereal
    </button>
  </div>
);

const viewButtonClasses = (active: boolean, compact: boolean) =>
  cn(
    HUD_LABEL_BRIGHT,
    "min-h-11 min-w-11 rounded-md px-3 font-sans transition-[color,background-color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.97] lg:min-h-7",
    compact && "px-2 tracking-normal",
    active ? "bg-gold/20 text-gold" : "text-gold/65",
  );

const layerButtonClasses = (active: boolean, compact = false) =>
  cn(
    HUD_LABEL_BRIGHT,
    "inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-md px-3 font-sans transition-[color,background-color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold active:scale-[0.97] lg:min-h-7",
    compact && "px-2 tracking-normal",
    active ? "bg-cyan-400/15 text-cyan-100" : "text-gold/65",
  );
