import "./phone-hud.css";

import { Icon } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import { formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { FrontierDayClock } from "./day-pill";
import { pickStores } from "./header-stores";
import { LandingDelta, STORE_TONES, storeLine, type StoreReading } from "./status-strip";

const BAR_STORE_KINDS: readonly StoreKind[] = ["essence", "labor", "wheat"];

type Stocks = {
  stores: readonly StoreReading[];
  realmName?: string | null;
  realmOpen?: boolean;
  onOpenRealm?: () => void;
};

export const FrontierTopBar = ({
  rules,
  onOpenToday,
  ...view
}: Omit<TopBarViewProps, "clock"> & { rules: ExpeditionRules; onOpenToday: () => void }) => (
  <TopBarView {...view} clock={<FrontierDayClock rules={rules} compact onOpenToday={onOpenToday} />} />
);

type TopBarViewProps = {
  stocks: Stocks;
  clock: ReactNode;
  placeSwitch?: ReactNode;
  quest?: ReactNode;
  notice?: ReactNode;
  spectatorChip?: ReactNode;
  realmCard?: ReactNode;
  todayCard?: ReactNode;
};

export const TopBarView = ({
  stocks,
  clock,
  placeSwitch,
  quest,
  notice,
  spectatorChip,
  realmCard,
  todayCard,
}: TopBarViewProps) => (
  <div className="frontier-phone-top">
    <div className="ui-popover frontier-bar pointer-events-auto">
      {placeSwitch}
      <StockChips {...stocks} />
      <div className="frontier-bar__day">{clock}</div>
    </div>
    {realmCard ?? (todayCard && <TodayUnderBar card={todayCard} />) ?? (
      <div data-map-cluster className="frontier-phone-float">
        <div className="frontier-phone-float__lead">
          {notice}
          {spectatorChip}
        </div>
        {quest && <div className="frontier-phone-float__quest">{quest}</div>}
      </div>
    )}
  </div>
);

const TodayUnderBar = ({ card }: { card: ReactNode }) => (
  <div className="frontier-phone-today">
    <SheetDock.Provider value={null}>{card}</SheetDock.Provider>
  </div>
);

const StockChips = ({ stores, realmName, realmOpen = false, onOpenRealm }: Stocks) => {
  const chips = pickStores(stores, BAR_STORE_KINDS).map((store) => <StockChip key={store.kind} store={store} />);
  return onOpenRealm && realmName ? (
    <button
      type="button"
      aria-label={realmName}
      aria-expanded={realmOpen}
      className="frontier-stock-chips"
      onClick={onOpenRealm}
    >
      {chips}
    </button>
  ) : (
    <div role="group" aria-label="Stores" className="frontier-stock-chips">
      {chips}
    </div>
  );
};

const StockChip = ({ store }: { store: StoreReading }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const line = storeLine(store);
  return (
    <span data-store={store.kind} role="img" aria-label={line} data-tip={line} className="frontier-stock-chip">
      <LandingDelta target={store.flyTarget} />
      <span data-fly-target={store.flyTarget} className="frontier-stock-chip__icon">
        <Icon name={FRONTIER_STORES[store.kind].icon} size={20} />
      </span>
      <span className={`frontier-stock-chip__value ${STORE_TONES[store.tone].text}`}>
        {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
      </span>
    </span>
  );
};
