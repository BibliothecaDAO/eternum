import { Icon } from "@/ui/design-system/icon";
import { HudPill, type MenuItem, useHudList } from "@/ui/design-system/kit/hud-elements";
import { layerName } from "@bibliothecadao/types";
import { reachMark } from "../depth-art";
import type { MapLayer, MapLayers } from "./map-layers";

const layerWord = (layer: MapLayer): string => layerName(layer === "deep" ? 3 : layer);
const layerIcon = (layer: MapLayer) => (layer === 0 ? "map" : reachMark(layer === "deep" ? 3 : layer));

export const SurfaceDeepSwitch = ({ layers, onSwitch }: { layers: MapLayers | null; onSwitch?: () => void }) => {
  const depthLayers = layers ? layers.layers.filter((layer) => layer !== 0) : [];
  const activeDepth = layers && layers.shown !== null && layers.shown !== 0 ? layers.shown : null;
  const targetDepth = activeDepth ?? depthLayers[depthLayers.length - 1] ?? null;
  const depthLabel = targetDepth ? layerWord(targetDepth) : layerName(3);
  const { triggerProps, list } = useHudList(depthLabel);

  if (!layers || layers.shown === null || depthLayers.length === 0 || targetDepth === null) return null;

  const choose = (layer: MapLayer) => {
    if (layer !== layers.shown) layers.go(layer);
    onSwitch?.();
  };

  const depthMenu: MenuItem[] | null =
    depthLayers.length > 1
      ? depthLayers.map((layer) => ({
          label: layerWord(layer),
          lead: <Icon name={layerIcon(layer)} size={20} />,
          checked: layer === layers.shown,
          onSelect: () => choose(layer),
        }))
      : null;

  return (
    <>
      <HudPill label="Map depth" role="group" className="ui-depth-switch pointer-events-auto">
        {[
          <div key="segments" data-surface-deep-switch className="ui-depth-switch__segments">
            <button
              type="button"
              aria-pressed={layers.shown === 0}
              onClick={() => choose(0)}
              className="ui-depth-switch__btn"
            >
              <Icon name="map" size={16} />
              <span>{layerName(0)}</span>
            </button>
            <button
              {...(depthMenu ? triggerProps : { onClick: () => choose(targetDepth) })}
              type="button"
              aria-pressed={activeDepth !== null}
              className="ui-depth-switch__btn"
            >
              <Icon name={layerIcon(targetDepth)} size={16} />
              <span>{depthLabel}</span>
            </button>
          </div>,
        ]}
      </HudPill>
      {depthMenu && list(depthMenu)}
    </>
  );
};
