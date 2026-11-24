import { Icon, type IconMeaning } from "@/ui/design-system/icon";
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
import { useHudPopover } from "./hud-popover";

type PlaceTabKey = "realm" | "surface" | EtherealLayer;

type PlaceSwitchProps = {
  isMapView: boolean;
  canOpenRealm?: boolean;
  layers: MapLayers | null;
  onGoRealm: () => void;
  onGoSurface: () => void;
  onSwitch?: () => void;
};

type PlaceEntry = {
  key: PlaceTabKey;
  label: string;
  mark: IconMeaning;
  depth?: EtherealLayer;
  selected: boolean;
  locked: boolean;
  line?: string;
  disabled: boolean;
  choose: () => void;
};

const placeEntries = ({
  isMapView,
  canOpenRealm = true,
  layers,
  onGoRealm,
  onGoSurface,
  onSwitch,
}: PlaceSwitchProps): PlaceEntry[] => {
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
  const depths = DEEP_LAYER_TIERS.map((tier): PlaceEntry => {
    const unlocked = unlockedLayerForTier(layers, tier);
    const layer: MapLayer = unlocked ?? (tier === 3 ? "deep" : tier);
    const locked = unlocked === null;
    return {
      key: tier,
      label: layerWord(layer),
      mark: layerMark(layer),
      depth: tier,
      selected: !locked && activeKey === tier,
      locked,
      line: locked ? SPIRE_WORDS.lockedAt(tier) : undefined,
      disabled: locked,
      choose: () => {
        if (unlocked !== null) chooseDepth(unlocked);
      },
    };
  });
  return [
    {
      key: "realm",
      label: REALM,
      mark: "realm",
      selected: activeKey === "realm",
      locked: false,
      disabled: !canOpenRealm,
      choose: onGoRealm,
    },
    {
      key: "surface",
      label: layerWord(0),
      mark: layerMark(0),
      selected: activeKey === "surface",
      locked: false,
      disabled: false,
      choose: onGoSurface,
    },
    ...depths,
  ];
};

export const FrontierPlaceSwitch = (props: PlaceSwitchProps) => (
  <div
    role="group"
    aria-label="Map view"
    data-surface-deep-switch
    data-variant="desktop"
    className="frontier-place-switch pointer-events-auto"
  >
    <div className="ui-tabs" role="tablist" data-size="sm">
      {placeEntries(props).map((entry) =>
        entry.depth === undefined ? (
          <button
            key={entry.key}
            type="button"
            role="tab"
            className="ui-tab"
            aria-label={entry.label}
            aria-selected={entry.selected}
            disabled={entry.disabled || undefined}
            onClick={entry.choose}
          >
            {entry.label}
          </button>
        ) : (
          <button
            key={entry.key}
            type="button"
            role="tab"
            className="ui-tab"
            data-depth={String(entry.depth)}
            data-locked={entry.locked || undefined}
            aria-label={entry.label}
            aria-selected={entry.selected}
            disabled={entry.disabled}
            title={entry.line}
            data-tip={entry.line}
            onClick={entry.choose}
          >
            <Icon name={entry.locked ? "lock" : entry.mark} size={entry.locked ? 12 : 14} />
            <span>{entry.label}</span>
          </button>
        ),
      )}
    </div>
  </div>
);

export const PlaceMenu = ({ realm, ...props }: PlaceSwitchProps & { realm?: { name: string; mark: IconMeaning } }) => {
  const entries = placeEntries(props).map((entry) =>
    entry.key === "realm" && realm ? { ...entry, mark: realm.mark, line: realm.name } : entry,
  );
  const shown = entries.find((entry) => entry.selected) ?? entries[1]!;
  const { open, close, triggerProps, popover } = useHudPopover();
  return (
    <div className="frontier-place-menu pointer-events-auto">
      <button
        type="button"
        {...triggerProps}
        aria-haspopup="true"
        aria-label={`Map view, ${shown.label}`}
        data-place-pill=""
        data-hud-part=""
        data-place={shown.label}
        className="frontier-place-pill"
      >
        <Icon name={shown.mark} size={22} />
        <span className="frontier-place-pill__name">{shown.label}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      {popover(
        <div role="tablist" aria-label="Map view" data-surface-deep-switch className="frontier-place-menu__list">
          {entries.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              className="ui-pick frontier-place-row"
              data-depth={entry.depth === undefined ? undefined : String(entry.depth)}
              data-locked={entry.locked || undefined}
              aria-label={entry.label}
              aria-selected={entry.selected}
              disabled={entry.disabled}
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
            </button>
          ))}
        </div>,
        { className: "frontier-place-popover", layout: "phone" },
      )}
    </div>
  );
};
