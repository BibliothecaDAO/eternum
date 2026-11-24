import "./phone-hud.css";

import { homeIcon, homeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort, rankName, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES } from "../stores";
import { DailyQuestChip } from "./daily-quest-chip";
import { FrontierDayClock } from "./day-pill";
import { FragmentsSocket, pickStores, StoreLiquidFill, TOP_BAR_STORE_KINDS } from "./header-stores";
import { RealmHeaderChip } from "./realm-header-chip";
import { LandingDelta, STORE_TONES, storeLine, storeRateText, type StoreReading } from "./status-strip";

const PhoneStoreGauge = ({ store, onToggle }: { store: StoreReading; onToggle?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const meta = FRONTIER_STORES[store.kind];
  const line = storeLine(store);
  const rate = storeRateText(store, { compact: true });
  const content = (
    <>
      <LandingDelta target={store.flyTarget} />
      <span data-fly-target={store.flyTarget} className="frontier-phone-gauge__icon">
        <Icon name={meta.icon} size={20} />
      </span>
      <span className="frontier-phone-gauge__well">
        <StoreLiquidFill store={store} />
        <span className="frontier-phone-gauge__values">
          <span className={STORE_TONES[store.tone].text}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
          </span>
          {rate && <span className="frontier-phone-gauge__rate">{rate}</span>}
        </span>
      </span>
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
  realmName,
  aspect,
  own,
  stores,
  realmOpen = false,
  placeSwitch,
  spectatorChip,
  fragments = null,
  onShop,
  storeCards,
  onOpenRealm,
  onOpenToday,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  realmName?: string | null;
  aspect?: AspectId;
  own: NativeRows["Structure"] | null;
  stores: readonly StoreReading[];
  realmOpen?: boolean;
  placeSwitch?: ReactNode;
  spectatorChip?: ReactNode;
  fragments?: number | null;
  onShop?: () => void;
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
      realm={
        realm
          ? {
              icon: homeIcon(kind, level),
              label: realmName || rankName(level),
              aspect,
              orderId: realm.metadata.order,
            }
          : undefined
      }
      realmOpen={realmOpen}
      stores={stores}
      clock={<FrontierDayClock rules={rules} compact onOpenToday={onOpenToday} />}
      placeSwitch={placeSwitch}
      spectatorChip={spectatorChip}
      quest={own ? <DailyQuestChip realm={own} layout="phone" /> : undefined}
      fragments={fragments}
      onShop={onShop}
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
  placeSwitch,
  spectatorChip,
  quest,
  fragments = null,
  onShop,
  storeCard,
  toggleableStores,
  onToggleStore,
  onOpenRealm,
}: {
  realm?: { icon: IconMeaning; label: string; aspect?: AspectId; orderId?: number };
  realmOpen?: boolean;
  stores: readonly StoreReading[];
  clock: ReactNode;
  placeSwitch?: ReactNode;
  spectatorChip?: ReactNode;
  quest?: ReactNode;
  fragments?: number | null;
  onShop?: () => void;
  storeCard?: ReactNode;
  toggleableStores?: readonly StoreReading["kind"][];
  onToggleStore?: (kind: StoreReading["kind"]) => void;
  onOpenRealm?: () => void;
}) => {
  const shownStores = pickStores(stores, TOP_BAR_STORE_KINDS);
  const hasFragments = fragments !== null && Boolean(onShop);
  const showSubRow = Boolean(realm || quest || hasFragments);
  const showUtilityRow = Boolean(placeSwitch || spectatorChip);

  return (
    <div className="frontier-phone-top">
      <div className="frontier-phone-cornice pointer-events-auto">
        <div className="frontier-phone-cornice__clock">{clock}</div>
        <div role="group" aria-label="Stores" className="frontier-phone-pill">
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
      {showSubRow && (
        <div data-top-row className="frontier-phone-subrow">
          <div className="frontier-phone-subrow__left">
            {realm && (
              <RealmHeaderChip
                variant="phone"
                name={realm.label}
                fallbackIcon={realm.icon}
                aspect={realm.aspect}
                orderId={realm.orderId}
                expanded={realmOpen}
                onPress={onOpenRealm}
              />
            )}
          </div>
          {(quest || hasFragments) && (
            <div className="frontier-phone-subrow__right">
              {quest}
              <FragmentsSocket fragments={fragments} onShop={onShop} compact />
            </div>
          )}
        </div>
      )}
      {showUtilityRow && (
        <div className="frontier-phone-utility">
          {placeSwitch}
          {spectatorChip}
        </div>
      )}
      {storeCard}
    </div>
  );
};
