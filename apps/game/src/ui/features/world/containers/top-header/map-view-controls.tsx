import { StructureType, structureName } from "@bibliothecadao/types";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton, HudPill, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { WORLD } from "@/ui/design-system/kit/words";

interface MapViewControlsProps {
  compact: boolean;
  isLocalView: boolean;
  canOpenLocal: boolean;
  mapLayer: boolean;
  showLayerSwitch: boolean;
  onNavigate: (world: boolean) => void;
  onLayerChange: (alt: boolean) => void;
}

/** Primary map navigation, with one space-saving layer toggle in the mobile HUD. */
export function MapViewControls({
  compact,
  isLocalView,
  canOpenLocal,
  mapLayer,
  showLayerSwitch,
  onNavigate,
  onLayerChange,
}: MapViewControlsProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <MapViewSwitch compact={compact} isLocalView={isLocalView} canOpenLocal={canOpenLocal} onNavigate={onNavigate} />
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
  canOpenLocal,
  onNavigate,
}: {
  compact: boolean;
  isLocalView: boolean;
  canOpenLocal: boolean;
  onNavigate: (world: boolean) => void;
}) => (
  <HudPill label="Map view" role="group" className={cn("pointer-events-auto", compact ? "px-1" : "px-2")}>
    {[
      <HudTabs
        key="view"
        tabs={[
          {
            key: "realm",
            label: structureName(StructureType.Realm),
            disabled: !canOpenLocal,
            title: canOpenLocal ? undefined : "Select a structure to open its realm view",
          },
          { key: "world", label: WORLD },
        ]}
        size="sm"
        value={isLocalView ? "realm" : "world"}
        onChange={(view) => onNavigate(view === "world")}
      />,
    ]}
  </HudPill>
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
  return (
    <HudPill label="Map layer" role="group" className="pointer-events-auto px-1">
      {[
        <HudButton
          key="layer"
          kind="quiet"
          size="sm"
          icon={mapLayer ? "travel" : "mountain"}
          aria-label={`Map layer: ${currentLayer}. Switch to ${nextLayer}`}
          title={`Switch to ${nextLayer}`}
          onClick={() => onLayerChange(!mapLayer)}
        >
          {currentLayer}
        </HudButton>,
      ]}
    </HudPill>
  );
};

const LayerSwitch = ({ mapLayer, onLayerChange }: { mapLayer: boolean; onLayerChange: (alt: boolean) => void }) => (
  <HudPill label="Map layer" role="group" className="pointer-events-auto px-2">
    {[
      <HudTabs
        key="layer"
        tabs={[
          { key: "surface", label: "Surface", icon: "mountain" },
          { key: "ethereal", label: "Ethereal", icon: "travel" },
        ]}
        size="sm"
        value={mapLayer ? "ethereal" : "surface"}
        onChange={(layer) => onLayerChange(layer === "ethereal")}
      />,
    ]}
  </HudPill>
);
