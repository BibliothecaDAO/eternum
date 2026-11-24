import "./phone-hud.css";

import { homeIcon, homeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort, rankName } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { DailyQuestChip } from "./daily-quest-chip";
import { FrontierDayClock } from "./day-pill";
import { pickStores } from "./header-stores";
import { LandingDelta, STORE_TONES, storeCapacityShare, storeLine, type StoreReading } from "./status-strip";

const PHONE_STORE_KINDS: readonly StoreKind[] = ["essence", "labor", "wheat", "troops"];

const PhoneStoreGauge = ({ store, onToggle }: { store: StoreReading; onToggle?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const meta = FRONTIER_STORES[store.kind];
  const line = storeLine(store);
  const share = storeCapacityShare(store);
  const content = (
    <>
      <LandingDelta target={store.flyTarget} />
      <span className="frontier-phone-gauge__head">
        <span data-fly-target={store.flyTarget} className="inline-flex shrink-0">
          <Icon name={meta.icon} size={14} />
        </span>
        <span className={STORE_TONES[store.tone].text}>
          {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
        </span>
      </span>
      {share !== undefined && (
        <span className="frontier-phone-gauge__bar" aria-hidden="true">
          <i
            className="frontier-phone-gauge__fill"
            data-tone={STORE_TONES[store.tone].meter}
            style={{ width: `${share * 100}%` }}
          />
        </span>
      )}
    </>
  );
  return onToggle ? (
    <button
      type="button"
      data-store={store.kind}
      aria-label={line}
      data-tip={line}
      className="frontier-phone-gauge"
      onClick={onToggle}
    >
      {content}
    </button>
  ) : (
    <span data-store={store.kind} role="img" aria-label={line} data-tip={line} className="frontier-phone-gauge">
      {content}
    </span>
  );
};

export const PhoneTopBar = ({
  rules,
  realm,
  own,
  stores,
  isMapView,
  realmOpen = false,
  depthSwitch,
  spectatorChip,
  storeCards,
  onOpenRealm,
  onOpenToday,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  own: NativeRows["Structure"] | null;
  stores: readonly StoreReading[];
  isMapView: boolean;
  realmOpen?: boolean;
  depthSwitch?: ReactNode;
  spectatorChip?: ReactNode;
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  onOpenRealm?: () => void;
  onOpenToday: () => void;
}) => {
  const kind = realm ? homeKind(realm.metadata.has_wonder) : "realm";
  const level = realm?.base.level ?? 0;

  return (
    <PhoneTopBarView
      realm={realm ? { icon: homeIcon(kind, level), label: rankName(level) } : undefined}
      realmOpen={realmOpen}
      stores={stores}
      clock={<FrontierDayClock rules={rules} compact onOpenToday={onOpenToday} />}
      isMapView={isMapView}
      depthSwitch={depthSwitch}
      spectatorChip={spectatorChip}
      quest={isMapView && own ? <DailyQuestChip realm={own} showTitle align="left" /> : undefined}
      storeCard={!realmOpen && storeCards?.open ? storeCards.card : undefined}
      toggleableStores={storeCards?.kinds}
      onToggleStore={storeCards?.onToggle}
      onOpenRealm={onOpenRealm}
    />
  );
};

export const PhoneTopBarView = ({
  realm,
  realmOpen = false,
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
}: {
  realm?: { icon: IconMeaning; label: string };
  realmOpen?: boolean;
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
}) => {
  const shownStores = pickStores(stores, PHONE_STORE_KINDS);

  return (
    <div className="frontier-phone-top">
      <div className="frontier-phone-row">
        {clock}
        <div role="group" aria-label="Stores" className="frontier-phone-pill pointer-events-auto">
          {shownStores.map((store) => (
            <PhoneStoreGauge
              key={store.kind}
              store={store}
              onToggle={
                onToggleStore && toggleableStores?.includes(store.kind) ? () => onToggleStore(store.kind) : undefined
              }
            />
          ))}
        </div>
      </div>
      {(realm || (isMapView && depthSwitch) || spectatorChip) && (
        <div className="frontier-phone-row">
          <div className="flex min-w-0 items-center gap-1.5">
            {realm && (
              <button
                type="button"
                className="frontier-phone-realm-chip pointer-events-auto"
                aria-label={realm.label}
                aria-expanded={realmOpen}
                onClick={onOpenRealm}
              >
                <Icon name={realm.icon} size={18} />
                <span className="truncate">{realm.label}</span>
              </button>
            )}
            {isMapView && depthSwitch}
          </div>
          {spectatorChip}
        </div>
      )}
      {quest && (
        <div data-top-row className="frontier-phone-row">
          {quest}
        </div>
      )}
      {storeCard}
    </div>
  );
};
