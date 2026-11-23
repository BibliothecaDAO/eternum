import { HudPill, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { layerChoices, layerMark, layerWord, type MapLayers, selectLayer } from "./map-layers";

export const SurfaceDeepSwitch = ({ layers, onSwitch }: { layers: MapLayers | null; onSwitch?: () => void }) => {
  const depthLayers = layers ? layers.layers.filter((layer) => layer !== 0) : [];
  const activeDepth = layers && layers.shown !== 0 ? layers.shown : null;
  const targetDepth = activeDepth ?? depthLayers[depthLayers.length - 1] ?? null;

  if (!layers || depthLayers.length === 0 || targetDepth === null) return null;

  const depthLabel = layerWord(targetDepth);
  const depthMenu = depthLayers.length > 1 ? layerChoices(layers, onSwitch) : undefined;

  return (
    <HudPill label="Map depth" role="group" className="pointer-events-auto px-2">
      {[
        <div key="segments" data-surface-deep-switch>
          <HudTabs
            size="sm"
            value={activeDepth !== null ? "depth" : "surface"}
            onChange={(tab) => selectLayer(layers, tab === "surface" ? 0 : targetDepth, onSwitch)}
            tabs={[
              { key: "surface", label: layerWord(0), icon: layerMark(0) },
              { key: "depth", label: depthLabel, icon: layerMark(targetDepth), menu: depthMenu },
            ]}
          />
        </div>,
      ]}
    </HudPill>
  );
};
