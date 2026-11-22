import { Icon } from "@/ui/design-system/icon";
import { HudPill, useHudList } from "@/ui/design-system/kit/hud-elements";
import { layerChoices, layerMark, layerWord, type MapLayers, selectLayer } from "./map-layers";

export const SurfaceDeepSwitch = ({ layers, onSwitch }: { layers: MapLayers | null; onSwitch?: () => void }) => {
  const depthLayers = layers ? layers.layers.filter((layer) => layer !== 0) : [];
  const activeDepth = layers && layers.shown !== 0 ? layers.shown : null;
  const targetDepth = activeDepth ?? depthLayers[depthLayers.length - 1] ?? null;
  const depthLabel = targetDepth ? layerWord(targetDepth) : layerWord("deep");
  const { triggerProps, list } = useHudList(depthLabel);

  if (!layers || depthLayers.length === 0 || targetDepth === null) return null;

  const depthMenu = depthLayers.length > 1 ? layerChoices(layers, onSwitch) : null;

  return (
    <>
      <HudPill label="Map depth" role="group" className="ui-depth-switch pointer-events-auto">
        {[
          <div key="segments" data-surface-deep-switch className="ui-depth-switch__segments">
            <button
              type="button"
              aria-pressed={layers.shown === 0}
              onClick={() => selectLayer(layers, 0, onSwitch)}
              className="ui-depth-switch__btn"
            >
              <Icon name={layerMark(0)} size={16} />
              <span>{layerWord(0)}</span>
            </button>
            <button
              {...(depthMenu ? triggerProps : { onClick: () => selectLayer(layers, targetDepth, onSwitch) })}
              type="button"
              aria-pressed={activeDepth !== null}
              className="ui-depth-switch__btn"
            >
              <Icon name={layerMark(targetDepth)} size={16} />
              <span>{depthLabel}</span>
            </button>
          </div>,
        ]}
      </HudPill>
      {depthMenu && list(depthMenu)}
    </>
  );
};
