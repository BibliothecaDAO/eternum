import "./frontier-bar.css";

import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudSegment } from "@/ui/design-system/kit/hud-elements";
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
import { useHudLayout, useHudSideways } from "@/hooks/helpers/use-compact-hud";
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

const LayerMenuList = ({ entries, onClose }: { entries: readonly LayerEntry[]; onClose: () => void }) => (
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
          onClose();
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
  </div>
);

const usePlaceSwitchState = (
  props: PlaceSwitchProps & { lines?: Partial<Record<LayerKey, string>> },
  placement: "below" | "above" = "below",
) => {
  const entries = layerEntries(props).map((entry) => ({
    ...entry,
    line: entry.locked ? entry.line : props.lines?.[entry.key],
  }));
  const shownKey = shownLayerKey(props.layers);
  const shown = entries.find((entry) => entry.key === shownKey) ?? entries[0]!;
  const inRealm = !props.isMapView;
  const { open, close, triggerProps, popover } = useHudPopover(placement);
  const layout = useHudLayout();
  return { entries, shown, inRealm, open, close, triggerProps, popover, layout };
};

export const PlaceSwitch = ({
  realm,
  lines,
  ...props
}: PlaceSwitchProps & { realm?: { mark: IconMeaning }; lines?: Partial<Record<LayerKey, string>> }) => {
  const { entries, shown, inRealm, open, close, triggerProps, popover, layout } = usePlaceSwitchState({
    ...props,
    lines,
  });
  return (
    <div
      role="group"
      aria-label={MAP_VIEW}
      data-place-switch=""
      data-place={inRealm ? REALM : shown.label}
      data-hud-part=""
      className="ui-popover frontier-place-switch pointer-events-auto"
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
      <HudSegment
        {...triggerProps}
        aria-haspopup="true"
        aria-label={`${MAP_VIEW}, ${shown.label}`}
        data-place-pill=""
        className="frontier-place-pill"
      >
        <Icon name={shown.mark} size={22} />
        <span className="frontier-place-pill__name">{shown.label}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </HudSegment>
      {popover(<LayerMenuList entries={entries} onClose={close} />, {
        className: "ui-popover frontier-place-popover",
        layout,
      })}
    </div>
  );
};

export const PhonePlaceTabs = ({
  realm,
  lines,
  surfaceOpen = false,
  ...props
}: PlaceSwitchProps & {
  realm?: { mark: IconMeaning };
  lines?: Partial<Record<LayerKey, string>>;
  surfaceOpen?: boolean;
}) => {
  const sideways = useHudSideways();
  const { entries, shown, inRealm, open, close, triggerProps, popover, layout } = usePlaceSwitchState(
    { ...props, lines },
    sideways ? "below" : "above",
  );
  return (
    <div
      role="group"
      aria-label={MAP_VIEW}
      data-place-switch=""
      data-place={inRealm ? REALM : shown.label}
      className="contents"
    >
      <button
        type="button"
        aria-label={REALM}
        aria-current={inRealm && !surfaceOpen ? "page" : undefined}
        disabled={props.canOpenRealm === false}
        className="frontier-tab frontier-place-switch__realm"
        onClick={() => {
          close();
          props.onGoRealm();
        }}
      >
        <span className="frontier-tab__icon">
          <Icon name={realm?.mark ?? "realm"} size={24} loading="eager" decoding="sync" />
        </span>
        <span className="frontier-tab__label">{REALM}</span>
      </button>
      <button
        type="button"
        {...triggerProps}
        aria-haspopup="true"
        aria-label={`${MAP_VIEW}, ${shown.label}`}
        aria-current={!inRealm && !surfaceOpen ? "page" : undefined}
        data-place-pill=""
        className="frontier-tab frontier-tab--layer"
      >
        <span className="frontier-tab__icon">
          <Icon name={shown.mark} size={24} loading="eager" decoding="sync" />
        </span>
        <span className="frontier-tab__label frontier-tab__label--layer">
          <span>{shown.label}</span>
          <Icon name={open ? "chevron-up" : "chevron-down"} size={11} />
        </span>
      </button>
      {popover(<LayerMenuList entries={entries} onClose={close} />, {
        className: "ui-popover frontier-place-popover",
        layout,
      })}
    </div>
  );
};
