import "./frontier-bar.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { armiesHere, MAP_VIEW, REALM } from "@/ui/design-system/kit/words";
import type { EtherealLayer } from "@bibliothecadao/eternum";
import {
  DEEP_LAYER_TIERS,
  layerLockLine,
  layerMark,
  layerWord,
  type MapLayer,
  type MapLayers,
  selectLayer,
  unlockedLayerForTier,
} from "./map-layers";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { useHudPopover } from "./hud-popover";

type LayerKey = "surface" | EtherealLayer;

type PlaceSwitchProps = {
  isMapView: boolean;
  canOpenRealm?: boolean;
  layers: MapLayers | null;
  onGoRealm: () => void;
  onGoSurface: () => void;
  onSwitch?: () => void;
};

export const placeLines = (armies: readonly { ethereal?: EtherealLayer }[]): Partial<Record<LayerKey, string>> => {
  const on = (layer: EtherealLayer | undefined) => armiesHere(armies.filter((army) => army.ethereal === layer).length);
  return { surface: on(undefined), 1: on(1), 2: on(2), 3: on(3) };
};

type LayerEntry = {
  key: LayerKey;
  label: string;
  mark: IconMeaning;
  depth?: EtherealLayer;
  selected: boolean;
  locked: boolean;
  line?: string;
  choose: () => void;
};

const shownLayerKey = (layers: MapLayers | null): LayerKey =>
  !layers || layers.shown === 0 ? "surface" : layers.shown === "deep" ? 3 : layers.shown;

const layerEntries = ({ isMapView, layers, onGoSurface, onSwitch }: PlaceSwitchProps): LayerEntry[] => {
  const shownKey = shownLayerKey(layers);
  const chooseDepth = (target: MapLayer) => {
    if (!layers) return;
    if (!isMapView) {
      layers.go(target);
      onSwitch?.();
    } else {
      selectLayer(layers, target, onSwitch);
    }
  };
  const depths = DEEP_LAYER_TIERS.map((tier): LayerEntry => {
    const unlocked = unlockedLayerForTier(layers, tier);
    const layer: MapLayer = unlocked ?? (tier === 3 ? "deep" : tier);
    const locked = unlocked === null;
    return {
      key: tier,
      label: layerWord(layer),
      mark: layerMark(layer),
      depth: tier,
      selected: isMapView && !locked && shownKey === tier,
      locked,
      line: locked ? layerLockLine(tier) : undefined,
      choose: () => {
        if (unlocked !== null) chooseDepth(unlocked);
      },
    };
  });
  return [
    {
      key: "surface",
      label: layerWord(0),
      mark: layerMark(0),
      selected: isMapView && shownKey === "surface",
      locked: false,
      choose: onGoSurface,
    },
    ...depths,
  ];
};

export const PlaceSwitch = ({
  realm,
  lines,
  ...props
}: PlaceSwitchProps & { realm?: { mark: IconMeaning }; lines?: Partial<Record<LayerKey, string>> }) => {
  const entries = layerEntries(props).map((entry) => ({
    ...entry,
    line: entry.locked ? entry.line : lines?.[entry.key],
  }));
  const shownKey = shownLayerKey(props.layers);
  const shown = entries.find((entry) => entry.key === shownKey) ?? entries[0]!;
  const inRealm = !props.isMapView;
  const { open, close, triggerProps, popover } = useHudPopover();
  const layout = useHudLayout();
  return (
    <div
      role="group"
      aria-label={MAP_VIEW}
      data-place-switch=""
      data-place={inRealm ? REALM : shown.label}
      data-hud-part=""
      className="frontier-place-switch pointer-events-auto"
    >
      <button
        type="button"
        aria-label={REALM}
        aria-pressed={inRealm}
        disabled={props.canOpenRealm === false}
        className="ui-pick frontier-place-switch__realm"
        onClick={() => {
          close();
          props.onGoRealm();
        }}
      >
        <Icon name={realm?.mark ?? "realm"} size={22} />
        <span className="frontier-place-switch__word">{REALM}</span>
      </button>
      <button
        type="button"
        {...triggerProps}
        aria-haspopup="true"
        aria-label={`${MAP_VIEW}, ${shown.label}`}
        data-place-pill=""
        className="ui-pill frontier-place-pill"
      >
        <Icon name={shown.mark} size={22} />
        <span className="frontier-place-pill__name">{shown.label}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {popover(
        <div role="tablist" aria-label={MAP_VIEW} data-surface-deep-switch className="frontier-place-menu__list">
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              className="ui-row frontier-place-row"
              data-depth={entry.depth === undefined ? undefined : String(entry.depth)}
              data-locked={entry.locked || undefined}
              aria-label={entry.label}
              aria-selected={entry.selected}
              disabled={entry.locked}
              onClick={() => {
                close();
                entry.choose();
              }}
            >
              <Icon name={entry.locked ? "lock" : entry.mark} size={26} />
              <span className="frontier-place-row__text">
                <span className="frontier-place-row__name">{entry.label}</span>
                {entry.line && <span className="frontier-place-row__line">{entry.line}</span>}
              </span>
              {entry.selected && <Icon name="check" size={16} className="frontier-place-row__check" />}
            </button>
          ))}
        </div>,
        { className: "ui-popover frontier-place-popover", layout },
      )}
    </div>
  );
};
