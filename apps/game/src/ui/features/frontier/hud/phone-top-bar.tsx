import "./phone-hud.css";

import { homeIcon, homeKind } from "@/ui/design-system/home-icons";
import type { IconMeaning } from "@/ui/design-system/icon";
import { Icon } from "@/ui/design-system/icon";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort, rankName, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { FrontierDayClock } from "./day-pill";
import { FragmentsSocket, pickStores } from "./header-stores";
import { RealmEmblem } from "./realm-header-chip";
import { LandingDelta, STORE_TONES, storeLine, type StoreReading } from "./status-strip";

const BAR_STORE_KINDS: readonly StoreKind[] = ["essence", "labor", "wheat"];

type StoreCards = {
  kinds: readonly StoreReading["kind"][];
  open: StoreReading["kind"] | null;
  onToggle: (kind: StoreReading["kind"]) => void;
  card: ReactNode;
};

type RealmFace = { icon: IconMeaning; label: string; aspect?: AspectId; orderId?: number };

type StocksProps = {
  stores: readonly StoreReading[];
  fragments?: number | null;
  onShop?: () => void;
  toggleableStores?: readonly StoreReading["kind"][];
  onToggleStore?: (kind: StoreReading["kind"]) => void;
};

export const FrontierTopBar = ({
  form,
  rules,
  realm,
  realmName,
  aspect,
  stores,
  realmOpen = false,
  placeMenu,
  quest,
  places,
  spectatorChip,
  fragments = null,
  onShop,
  storeCards,
  realmCard,
  onOpenRealm,
  onOpenToday,
}: {
  form: "phone" | "tablet";
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  realmName?: string | null;
  aspect?: AspectId;
  stores: readonly StoreReading[];
  realmOpen?: boolean;
  placeMenu?: ReactNode;
  quest?: ReactNode;
  places?: ReactNode;
  spectatorChip?: ReactNode;
  fragments?: number | null;
  onShop?: () => void;
  storeCards?: StoreCards;
  realmCard?: ReactNode;
  onOpenRealm?: () => void;
  onOpenToday: () => void;
}) => {
  const level = realm?.base.level ?? 0;
  const face: RealmFace | undefined = realm
    ? {
        icon: homeIcon(homeKind(realm.metadata.has_wonder), level),
        label: realmName || rankName(level),
        aspect,
        orderId: realm.metadata.order,
      }
    : undefined;
  const View = form === "tablet" ? TabletTopBarView : PhoneTopBarView;
  return (
    <View
      realm={face}
      realmOpen={realmOpen}
      stocks={{
        stores,
        fragments,
        onShop,
        toggleableStores: storeCards?.kinds,
        onToggleStore: storeCards?.onToggle,
      }}
      clock={<FrontierDayClock rules={rules} compact onOpenToday={onOpenToday} />}
      placeMenu={placeMenu}
      quest={quest}
      places={places}
      spectatorChip={spectatorChip}
      storeCard={!realmCard && storeCards?.open ? storeCards.card : undefined}
      realmCard={realmCard}
      onOpenRealm={onOpenRealm}
    />
  );
};

type TopBarViewProps = {
  realm?: RealmFace;
  stocks: StocksProps;
  realmOpen?: boolean;
  clock: ReactNode;
  placeMenu?: ReactNode;
  quest?: ReactNode;
  places?: ReactNode;
  spectatorChip?: ReactNode;
  storeCard?: ReactNode;
  realmCard?: ReactNode;
  onOpenRealm?: () => void;
};

export const PhoneTopBarView = ({
  realm,
  realmOpen = false,
  clock,
  placeMenu,
  quest,
  spectatorChip,
  storeCard,
  realmCard,
  onOpenRealm,
  stocks,
}: TopBarViewProps) => (
  <div className="frontier-phone-top">
    <div className="frontier-phone-cornice pointer-events-auto">
      {realm && (
        <RealmEmblem
          name={realm.label}
          fallbackIcon={realm.icon}
          aspect={realm.aspect}
          orderId={realm.orderId}
          expanded={realmOpen}
          onPress={onOpenRealm}
        />
      )}
      <StockChips {...stocks} />
      <div className="frontier-phone-cornice__clock">{clock}</div>
    </div>
    <div data-map-cluster className="frontier-phone-float">
      {placeMenu}
      {spectatorChip}
      {quest && <div className="frontier-phone-float__quest">{quest}</div>}
    </div>
    {realmCard}
    {storeCard}
  </div>
);

export const TabletTopBarView = ({
  clock,
  placeMenu,
  quest,
  places,
  spectatorChip,
  storeCard,
  realmCard,
}: TopBarViewProps) => (
  <div className="frontier-tablet-top">
    <div className="frontier-tablet-bar pointer-events-auto">
      <div className="frontier-tablet-bar__centre">
        {clock}
        {quest}
        {placeMenu}
      </div>
      <div className="frontier-tablet-bar__places">{places}</div>
    </div>
    <div data-map-cluster className="frontier-tablet-float">
      <div className="frontier-tablet-realm">{realmCard}</div>
      {spectatorChip}
    </div>
    {storeCard}
  </div>
);

const StockChips = ({ stores, fragments = null, onShop, toggleableStores, onToggleStore }: StocksProps) => (
  <div role="group" aria-label="Stores" className="frontier-stock-chips">
    {pickStores(stores, BAR_STORE_KINDS).map((store) => (
      <StockChip
        key={store.kind}
        store={store}
        onToggle={onToggleStore && toggleableStores?.includes(store.kind) ? () => onToggleStore(store.kind) : undefined}
      />
    ))}
    <FragmentsSocket fragments={fragments} onShop={onShop} compact />
  </div>
);

const StockChip = ({ store, onToggle }: { store: StoreReading; onToggle?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const line = storeLine(store);
  const content = (
    <>
      <LandingDelta target={store.flyTarget} />
      <span data-fly-target={store.flyTarget} className="frontier-stock-chip__icon">
        <Icon name={FRONTIER_STORES[store.kind].icon} size={20} />
      </span>
      <span className={`frontier-stock-chip__value ${STORE_TONES[store.tone].text}`}>
        {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
      </span>
    </>
  );
  return onToggle ? (
    <button
      type="button"
      data-store={store.kind}
      aria-label={line}
      data-tip={line}
      className="frontier-stock-chip"
      onClick={onToggle}
    >
      {content}
    </button>
  ) : (
    <span data-store={store.kind} role="img" aria-label={line} data-tip={line} className="frontier-stock-chip">
      {content}
    </span>
  );
};
