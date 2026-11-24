import "./frontier-desktop.css";

import { homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon, type IconMeaning } from "@/ui/design-system/icon";
import { HudButton, HudChip, HudIconButton, HudRow, HudTier } from "@/ui/design-system/kit/hud-elements";
import { OrderLine, resolvedOrder } from "@/ui/design-system/kit/order-emblem";
import {
  CLOSE,
  MAX_LEVEL,
  REALM,
  REALM_POP,
  SHOP_WORDS,
  SHOW_MY_REALM,
  UPGRADE,
  type Rank,
} from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import { aspectName, FRAGMENTS, formatShort, LORDS, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, isMadeStore, isTroopStore, type StoreKind } from "../stores";
import { AspectMedallion } from "./realm-header-chip";
import { LandingDelta, STORE_TONES, storeLine, storeRateText, type StoreReading } from "./status-strip";

export interface RealmBuildingItem {
  key: string;
  icon: IconMeaning;
  name: string;
  tier?: Rank;
  rankLabel?: string;
  rateIcon?: IconMeaning;
  rate?: string;
  onUpgrade?: () => void;
  maxed?: boolean;
}

export const RealmCard = ({
  name,
  kind,
  level,
  nextRank,
  aspect,
  orderId,
  population,
  stores,
  fragments,
  lords,
  buildings,
  storeCard,
  onStore,
  onShop,
  onHome,
  onUpgradeCastle,
  onClose,
}: {
  name: string;
  kind: HomeKind;
  level: number;
  nextRank?: string;
  aspect?: AspectId;
  orderId?: number;
  population?: { used: number; max: number };
  stores: readonly StoreReading[];
  fragments: number | null;
  lords: number | null;
  buildings?: readonly RealmBuildingItem[];
  storeCard?: ReactNode;
  onStore?: (kind: StoreKind) => void;
  onShop?: () => void;
  onHome?: () => void;
  onUpgradeCastle?: () => void;
  onClose?: () => void;
}) => (
  <section
    aria-label={REALM}
    data-hud-part=""
    className="frontier-cluster-card frontier-realm-card pointer-events-auto"
  >
    <header className="frontier-realm-card__head">
      <button
        type="button"
        className="frontier-realm-card__identity"
        aria-label={onHome ? SHOW_MY_REALM : name}
        disabled={!onHome}
        onClick={onHome}
      >
        <AspectMedallion
          aspect={aspect}
          fallbackIcon={homeIcon(kind, level)}
          tip={aspect !== undefined ? aspectName(aspect) : undefined}
          decorative={false}
          size="lg"
        />
        <span className="frontier-realm-card__text">
          <span className="frontier-realm-card__name">{name}</span>
          <span className="frontier-realm-card__sub">
            <OrderLine orderId={orderId} size={14} className="frontier-realm-card__order" />
            {resolvedOrder(orderId) && population && <span aria-hidden="true">·</span>}
            {population && <span>{REALM_POP(population.used, population.max)}</span>}
          </span>
        </span>
      </button>
      {onUpgradeCastle && nextRank && (
        <button
          type="button"
          data-realm-castle
          className="frontier-rank-up"
          aria-label={`${UPGRADE} · ${nextRank}`}
          onClick={onUpgradeCastle}
        >
          {nextRank}
          <Icon name="arrow-up" size={12} />
        </button>
      )}
      {onClose && <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />}
    </header>
    <div role="group" aria-label="Stores" className="frontier-stocks">
      <ul className="frontier-stocks__row">
        {stores
          .filter((store) => !isTroopStore(store.kind))
          .map((store) => (
            <li key={store.kind} data-store={store.kind} className="frontier-stock">
              <StockTile store={store} onOpen={onStore} />
            </li>
          ))}
        <li data-store="fragments" className="frontier-stock" data-broad>
          <FigureTile
            icon="fragment"
            value={fragments === null ? "—" : `${formatShort(fragments)} +`}
            caption={FRAGMENTS}
            label={fragments === null ? FRAGMENTS : SHOP_WORDS.fragments(fragments)}
            onPress={fragments === null ? undefined : onShop}
          />
        </li>
        <li data-store="lords" className="frontier-stock">
          <FigureTile
            icon="lords"
            value={lords === null ? "—" : formatShort(lords)}
            caption={LORDS}
            label={lords === null ? LORDS : `${LORDS} ${formatShort(lords)}`}
          />
        </li>
      </ul>
      <ul className="frontier-stocks__row">
        {stores
          .filter((store) => isTroopStore(store.kind))
          .map((store) => (
            <li key={store.kind} data-store={store.kind} className="frontier-stock" data-wide>
              <TroopTile store={store} onOpen={onStore} />
            </li>
          ))}
      </ul>
    </div>
    {storeCard}
    {buildings && buildings.length > 0 && (
      <ul data-realm-buildings className="frontier-realm-card__buildings">
        {buildings.map((building) => (
          <li key={building.key}>
            <HudRow
              lead={<Icon name={building.icon} size={28} />}
              title={
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{building.name}</span>
                  {building.tier !== undefined && <HudTier tier={building.tier} />}
                  {building.rankLabel && <HudChip>{building.rankLabel}</HudChip>}
                </span>
              }
              detail={
                building.rate && (
                  <span className="inline-flex items-center gap-1 tabular-nums text-hud-good">
                    {building.rateIcon && <Icon name={building.rateIcon} size={14} />}
                    {building.rate}
                  </span>
                )
              }
              controls={
                building.onUpgrade ? (
                  <HudButton kind="secondary" size="sm" onClick={building.onUpgrade}>
                    {UPGRADE}
                  </HudButton>
                ) : building.maxed ? (
                  <span className="realm-building__max">{MAX_LEVEL}</span>
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
    )}
  </section>
);

const StockTile = ({ store, onOpen }: { store: StoreReading; onOpen?: (kind: StoreKind) => void }) => {
  const rate = storeRateText(store, { compact: true });
  return (
    <StoreFace store={store} onOpen={onOpen}>
      <span data-fly-target={store.flyTarget} className="frontier-stock__icon">
        <Icon name={FRONTIER_STORES[store.kind].icon} size={20} />
      </span>
      <StoreValue store={store} />
      <span className="frontier-stock__caption" data-tone={rate ? "good" : undefined}>
        {rate ?? FRONTIER_STORES[store.kind].word}
      </span>
    </StoreFace>
  );
};

const TroopTile = ({ store, onOpen }: { store: StoreReading; onOpen?: (kind: StoreKind) => void }) => {
  const rate = storeRateText(store, { compact: true });
  return (
    <StoreFace store={store} onOpen={onOpen}>
      <span className="frontier-stock__top">
        <span data-fly-target={store.flyTarget} className="frontier-stock__icon">
          <Icon name={FRONTIER_STORES[store.kind].icon} size={20} />
        </span>
        <StoreValue store={store} />
        {rate && (
          <span className="frontier-stock__caption" data-tone="good">
            {rate}
          </span>
        )}
      </span>
      <span className="frontier-stock__caption">{FRONTIER_STORES[store.kind].word}</span>
    </StoreFace>
  );
};

const StoreFace = ({
  store,
  onOpen,
  children,
}: {
  store: StoreReading;
  onOpen?: (kind: StoreKind) => void;
  children: ReactNode;
}) => (
  <>
    <LandingDelta target={store.flyTarget} />
    <TileFace
      label={storeLine(store)}
      onPress={onOpen && isMadeStore(store.kind) ? () => onOpen(store.kind) : undefined}
    >
      {children}
    </TileFace>
  </>
);

const StoreValue = ({ store }: { store: StoreReading }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  return (
    <span className={`frontier-stock__value tabular-nums ${STORE_TONES[store.tone].text}`}>
      {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
    </span>
  );
};

const FigureTile = ({
  icon,
  value,
  caption,
  label,
  onPress,
}: {
  icon: "fragment" | "lords";
  value: string;
  caption: string;
  label: string;
  onPress?: () => void;
}) => (
  <TileFace label={label} onPress={onPress}>
    <span className="frontier-stock__icon">
      <Icon name={icon} size={20} />
    </span>
    <span className="frontier-stock__value tabular-nums">{value}</span>
    <span className="frontier-stock__caption">{caption}</span>
  </TileFace>
);

const TileFace = ({ label, onPress, children }: { label: string; onPress?: () => void; children: ReactNode }) =>
  onPress ? (
    <button type="button" className="frontier-stock__face" aria-label={label} data-tip={label} onClick={onPress}>
      {children}
    </button>
  ) : (
    <span role="img" className="frontier-stock__face" aria-label={label} data-tip={label}>
      {children}
    </span>
  );
