import { Icon } from "@/ui/design-system/icon";
import { REALM, SPIRE_WORDS } from "@/ui/design-system/kit/words";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import {
  DEEP_LAYER_TIERS,
  layerMark,
  layerWord,
  type MapLayer,
  type MapLayers,
  selectLayer,
  unlockedLayerForTier,
} from "./map-layers";

type PlaceTabKey = "realm" | "surface" | EtherealLayer;

export const FrontierPlaceSwitch = ({
  isMapView,
  canOpenRealm = true,
  layers,
  onGoRealm,
  onGoSurface,
  onSwitch,
  variant = "desktop",
}: {
  isMapView: boolean;
  canOpenRealm?: boolean;
  layers: MapLayers | null;
  onGoRealm: () => void;
  onGoSurface: () => void;
  onSwitch?: () => void;
  variant?: "desktop" | "phone";
}) => {
  const activeKey: PlaceTabKey = !isMapView
    ? "realm"
    : !layers || layers.shown === 0
      ? "surface"
      : layers.shown === "deep"
        ? 3
        : layers.shown;

  const chooseDepth = (target: MapLayer) => {
    if (!layers) return;
    if (!isMapView) {
      layers.go(target);
      onSwitch?.();
    } else {
      selectLayer(layers, target, onSwitch);
    }
  };

  return (
    <div
      role="group"
      aria-label="Map view"
      data-surface-deep-switch
      data-variant={variant}
      className="frontier-place-switch pointer-events-auto"
    >
      <div className="ui-tabs" role="tablist" data-size="sm">
        <button
          type="button"
          role="tab"
          className="ui-tab"
          aria-label={REALM}
          aria-selected={activeKey === "realm"}
          disabled={!canOpenRealm}
          onClick={onGoRealm}
        >
          {REALM}
        </button>
        <button
          type="button"
          role="tab"
          className="ui-tab"
          aria-label={layerWord(0)}
          aria-selected={activeKey === "surface"}
          onClick={onGoSurface}
        >
          {layerWord(0)}
        </button>
        {DEEP_LAYER_TIERS.map((tier) => {
          const unlocked = unlockedLayerForTier(layers, tier);
          const layer: MapLayer = unlocked ?? (tier === 3 ? "deep" : tier);
          const label = layerWord(layer);
          const locked = unlocked === null;
          const lockTip = locked ? SPIRE_WORDS.lockedAt(tier) : undefined;
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              className="ui-tab"
              data-depth={String(tier)}
              data-locked={locked || undefined}
              aria-label={label}
              aria-selected={!locked && activeKey === tier}
              disabled={locked}
              title={lockTip}
              data-tip={lockTip}
              onClick={() => {
                if (unlocked !== null) chooseDepth(unlocked);
              }}
            >
              {locked ? (
                <Icon name="lock" size={variant === "phone" ? 11 : 12} />
              ) : variant === "desktop" ? (
                <Icon name={layerMark(layer)} size={14} />
              ) : null}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
