import "./phone-hud.css";

import { homeIcon, homeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudPill, HudTabs } from "@/ui/design-system/kit/hud-elements";
import { REALM, WORLD } from "@/ui/design-system/kit/words";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { rankName } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { DailyQuestChip } from "./daily-quest-chip";
import { FrontierDayClock } from "./day-pill";
import { BarStoreItem, pickStores, REALM_STORE_KINDS } from "./header-stores";
import type { StoreReading } from "./status-strip";

export const PhoneTopBar = ({
  rules,
  realm,
  own,
  stores,
  isMapView,
  depthSwitch,
  spectatorChip,
  storeCards,
  onOpenRealm,
  onSwitchView,
  onOpenToday,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  own: NativeRows["Structure"] | null;
  stores: readonly StoreReading[];
  isMapView: boolean;
  depthSwitch?: ReactNode;
  spectatorChip?: ReactNode;
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  onOpenRealm?: () => void;
  onSwitchView: (toRealm: boolean) => void;
  onOpenToday: () => void;
}) => {
  const kind = realm ? homeKind(realm.metadata.has_wonder) : "realm";
  const level = realm?.base.level ?? 0;

  return (
    <PhoneTopBarView
      realm={realm ? { icon: homeIcon(kind, level), label: rankName(level) } : undefined}
      stores={stores}
      clock={<FrontierDayClock rules={rules} onOpenToday={onOpenToday} />}
      isMapView={isMapView}
      depthSwitch={depthSwitch}
      spectatorChip={spectatorChip}
      quest={isMapView && own ? <DailyQuestChip realm={own} showTitle align="left" /> : undefined}
      storeCard={storeCards?.open ? storeCards.card : undefined}
      toggleableStores={storeCards?.kinds}
      onToggleStore={storeCards?.onToggle}
      onOpenRealm={onOpenRealm}
      onSwitchView={onSwitchView}
    />
  );
};

export const PhoneTopBarView = ({
  realm,
  stores,
  clock,
  isMapView,
  depthSwitch,
  spectatorChip,
  quest,
  storeCard,
  toggleableStores,
  onToggleStore,
  onOpenRealm,
  onSwitchView,
}: {
  realm?: { icon: IconMeaning; label: string };
  stores: readonly StoreReading[];
  clock: ReactNode;
  isMapView: boolean;
  depthSwitch?: ReactNode;
  spectatorChip?: ReactNode;
  quest?: ReactNode;
  storeCard?: ReactNode;
  toggleableStores?: readonly StoreReading["kind"][];
  onToggleStore?: (kind: StoreReading["kind"]) => void;
  onOpenRealm?: () => void;
  onSwitchView: (toRealm: boolean) => void;
}) => {
  const shownStores = pickStores(stores, REALM_STORE_KINDS);

  return (
    <div className="frontier-phone-top">
      <div className="frontier-phone-row">
        <div className="frontier-phone-pill pointer-events-auto">
          {realm && (
            <>
              <button type="button" className="frontier-phone-realm" aria-label={realm.label} onClick={onOpenRealm}>
                <Icon name={realm.icon} size={18} />
                <span>{realm.label}</span>
              </button>
              <span className="frontier-phone-divider" aria-hidden="true" />
            </>
          )}
          {shownStores.map((store) => (
            <BarStoreItem
              key={store.kind}
              store={store}
              iconSize={15}
              onToggle={
                onToggleStore && toggleableStores?.includes(store.kind) ? () => onToggleStore(store.kind) : undefined
              }
            />
          ))}
        </div>
        {clock}
      </div>
      <div className="frontier-phone-row">
        <div className="flex min-w-0 items-center gap-1.5">
          {isMapView && depthSwitch}
          {spectatorChip}
        </div>
        <HudPill label="Map view" role="group" className="pointer-events-auto ml-auto px-1.5">
          {[
            <HudTabs
              key="view"
              size="sm"
              value={isMapView ? "world" : "realm"}
              onChange={(view) => onSwitchView(view === "realm")}
              tabs={[
                { key: "realm", label: REALM },
                { key: "world", label: WORLD },
              ]}
            />,
          ]}
        </HudPill>
      </div>
      {quest && (
        <div data-top-row className="frontier-phone-row">
          {quest}
        </div>
      )}
      {storeCard}
    </div>
  );
};
