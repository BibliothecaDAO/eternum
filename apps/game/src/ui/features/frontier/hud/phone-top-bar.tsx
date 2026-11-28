import "./phone-hud.css";

import { Icon } from "@/ui/design-system/icon";
import { SheetDock } from "@/ui/design-system/kit/hud-elements";
import { MENU, SEASON } from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import type { ExpeditionRules } from "@bibliothecadao/eternum";
import { formatShort, UNKNOWN } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { FrontierDayClock } from "./day-pill";
import { pickStores } from "./header-stores";
import { hudGloryTip, type HudGloryState } from "./hud-glory";
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

type SeasonGlory = {
  glory: HudGloryState;
  open?: boolean;
  onOpen: () => void;
};

type TopBarMenu = {
  open?: boolean;
  dot?: string;
  onOpen: () => void;
};

type TopBarViewProps = {
  stocks: Stocks;
  clock: ReactNode;
  season?: SeasonGlory;
  menu?: TopBarMenu;
  quest?: ReactNode;
  questCard?: ReactNode;
  notice?: ReactNode;
  spectatorChip?: ReactNode;
  realmCard?: ReactNode;
  todayCard?: ReactNode;
};

export const TopBarView = ({
  stocks,
  clock,
  season,
  menu,
  quest,
  questCard,
  notice,
  spectatorChip,
  realmCard,
  todayCard,
}: TopBarViewProps) => (
  <div className="frontier-phone-top">
    <div className="frontier-phone-top__row">
      <div className="ui-popover frontier-bar pointer-events-auto" data-has-glory={season ? "" : undefined}>
        <StockChips {...stocks} />
        {season && <SeasonGloryButton {...season} />}
        <div className="frontier-bar__day">{clock}</div>
      </div>
      {menu && <PhoneMenuButton {...menu} />}
    </div>
    {realmCard ?? (todayCard && <TodayUnderBar card={todayCard} />) ?? (
      <div data-map-cluster className="frontier-phone-float">
        <div className="frontier-phone-float__lead">
          {notice}
          {spectatorChip}
        </div>
        {quest && (
          <div className="frontier-phone-float__quest">
            {questCard}
            {quest}
          </div>
        )}
      </div>
    )}
  </div>
);

const PhoneMenuButton = ({ open = false, dot, onOpen }: TopBarMenu) => (
  <button
    type="button"
    aria-label={MENU}
    aria-current={open ? "page" : undefined}
    aria-expanded={open}
    data-hud-menu=""
    data-hud-part=""
    className="ui-popover frontier-menu-btn pointer-events-auto"
    onClick={onOpen}
  >
    <Icon name="menu" size={20} loading="eager" decoding="sync" />
    {dot && <span className="frontier-menu-btn__dot" data-dot="" aria-label={dot} />}
  </button>
);

const SeasonGloryButton = ({ glory, open = false, onOpen }: SeasonGlory) => (
  <button
    type="button"
    aria-label={SEASON}
    aria-expanded={open}
    data-tip={hudGloryTip(glory)}
    data-glory="true"
    className="frontier-bar__glory"
    onClick={onOpen}
  >
    <Icon name="crown" size={14} />
    <span className="frontier-bar__glory-value" data-glory-value="">
      {formatShort(glory.glory)}
    </span>
    {glory.active && <span className="frontier-bar__glory-live" data-glory-live="" aria-hidden="true" />}
  </button>
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
        {shown === undefined ? UNKNOWN : <TickNumber value={shown} format={formatShort} />}
      </span>
    </span>
  );
};
