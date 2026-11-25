import "./realm-card.css";

import { homeIcon, type HomeKind } from "@/ui/design-system/home-icons";
import { Icon } from "@/ui/design-system/icon";
import { HudButton, HudIconButton } from "@/ui/design-system/kit/hud-elements";
import { OrderLine } from "@/ui/design-system/kit/order-emblem";
import { PRICE_FACES, type Price } from "@/ui/design-system/kit/price-faces";
import {
  CLOSE,
  REALM,
  REALM_CARD_WORDS,
  SHOP_WORDS,
  SHOW_MY_REALM,
  UPGRADE,
  UPGRADING,
} from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import { aspectName, FRAGMENTS, formatShort, LORDS, rankName, type AspectId } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import type { LordsReading } from "@/shell/value/use-lords-balance";

import { FRONTIER_STORES, isMadeStore, isTroopStore, type StoreKind } from "../stores";
import { AspectMedallion } from "./realm-header-chip";
import { LandingDelta, STORE_TONES, storeLine, storeRateText, type StoreReading } from "./status-strip";

export interface RealmRankUp {
  name: string;
  gives?: string;
  need?: Price;
  refusal?: string;
  sending: boolean;
  onUpgrade?: () => void;
}

export const RealmCard = ({
  name,
  kind,
  level,
  rankUp,
  aspect,
  orderId,
  stores,
  fragments,
  lords,
  storeCard,
  onStore,
  onShop,
  onHome,
  onClose,
}: {
  name: string;
  kind: HomeKind;
  level: number;
  rankUp?: RealmRankUp;
  aspect?: AspectId;
  orderId?: number;
  stores: readonly StoreReading[];
  fragments: number | null;
  lords: LordsReading | null;
  storeCard?: ReactNode;
  onStore?: (kind: StoreKind) => void;
  onShop?: () => void;
  onHome?: () => void;
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
            <span>{rankName(level)}</span>
            <OrderLine orderId={orderId} size={16} className="frontier-realm-card__order" />
          </span>
        </span>
      </button>
      {onClose && <HudIconButton icon="close" label={CLOSE} kind="quiet" size="sm" onClick={onClose} />}
    </header>
    <div role="group" aria-label={REALM_CARD_WORDS.stores} className="frontier-realm-card__stores">
      <ul className="frontier-realm-card__cells">
        {stores
          .filter((store) => !isTroopStore(store.kind))
          .map((store) => (
            <li key={store.kind} data-store={store.kind}>
              <StoreCell store={store} onOpen={onStore} />
            </li>
          ))}
        <li data-store="fragments">
          <Cell
            icon={<Icon name="fragment" size={30} />}
            value={fragments === null ? "—" : formatShort(fragments)}
            caption={SHOP_WORDS.title}
            tone="gold"
            label={fragments === null ? FRAGMENTS : SHOP_WORDS.fragments(fragments)}
            onPress={fragments === null ? undefined : onShop}
          />
        </li>
        <li data-store="lords">
          <Cell
            icon={<Icon name="lords" size={30} />}
            value={typeof lords === "number" ? formatShort(lords) : "—"}
            caption={LORDS}
            label={lordsLine(lords)}
          />
        </li>
      </ul>
      <ul className="frontier-realm-card__cells">
        {stores
          .filter((store) => isTroopStore(store.kind))
          .map((store) => (
            <li key={store.kind} data-store={store.kind} data-row="">
              <StoreCell store={store} troop onOpen={onStore} />
            </li>
          ))}
      </ul>
    </div>
    {storeCard}
    {rankUp && <NextRank rankUp={rankUp} />}
  </section>
);

const StoreCell = ({
  store,
  troop = false,
  onOpen,
}: {
  store: StoreReading;
  troop?: boolean;
  onOpen?: (kind: StoreKind) => void;
}) => {
  const rate = storeRateText(store);
  return (
    <>
      <LandingDelta target={store.flyTarget} />
      <Cell
        icon={
          <span data-fly-target={store.flyTarget} className="inline-flex">
            <Icon name={FRONTIER_STORES[store.kind].icon} size={troop ? 34 : 30} />
          </span>
        }
        value={<StoreValue store={store} />}
        caption={rate ?? (troop ? undefined : FRONTIER_STORES[store.kind].word)}
        tone={rate ? "good" : undefined}
        label={storeLine(store)}
        onPress={onOpen && isMadeStore(store.kind) ? () => onOpen(store.kind) : undefined}
      />
    </>
  );
};

const StoreValue = ({ store }: { store: StoreReading }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  return (
    <span className={STORE_TONES[store.tone].text}>
      {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
    </span>
  );
};

const Cell = ({
  icon,
  value,
  caption,
  tone,
  label,
  onPress,
}: {
  icon: ReactNode;
  value: ReactNode;
  caption?: string;
  tone?: "good" | "gold";
  label: string;
  onPress?: () => void;
}) => {
  const face = (
    <>
      {icon}
      <span className="frontier-realm-card__figures">
        <b className="frontier-realm-card__value">{value}</b>
        {caption && (
          <span className="frontier-realm-card__caption" data-tone={tone}>
            {caption}
          </span>
        )}
      </span>
    </>
  );
  return onPress ? (
    <button type="button" className="frontier-realm-card__cell" aria-label={label} data-tip={label} onClick={onPress}>
      {face}
    </button>
  ) : (
    <span role="img" className="frontier-realm-card__cell" aria-label={label} data-tip={label}>
      {face}
    </span>
  );
};

const NextRank = ({ rankUp }: { rankUp: RealmRankUp }) => (
  <footer className="frontier-realm-card__next">
    <span className="frontier-realm-card__next-line">
      {REALM_CARD_WORDS.nextRank} <b>{rankUp.name}</b>
      {rankUp.gives && <span className="text-hud-muted"> · {rankUp.gives}</span>}
    </span>
    {rankUp.onUpgrade ? (
      <HudButton
        kind="primary"
        size="sm"
        icon="upgrade"
        data-realm-castle=""
        busy={rankUp.sending ? UPGRADING : undefined}
        onClick={rankUp.onUpgrade}
      >
        {UPGRADE}
      </HudButton>
    ) : (
      <span
        role="img"
        data-realm-castle=""
        className="frontier-realm-card__locked"
        aria-label={lockedLine(rankUp)}
        data-tip={lockedLine(rankUp)}
      >
        <Icon name="lock" size={16} />
        {rankUp.need ? (
          <>
            {REALM_CARD_WORDS.needs} {formatShort(rankUp.need.amount)}
            {PRICE_FACES[rankUp.need.of].icon && <Icon name={PRICE_FACES[rankUp.need.of].icon!} size={18} />}
          </>
        ) : (
          UPGRADE
        )}
      </span>
    )}
  </footer>
);

const lockedLine = ({ name, refusal }: RealmRankUp) =>
  refusal ? `${UPGRADE} · ${name}: ${refusal}` : `${UPGRADE} · ${name}`;

const lordsLine = (lords: LordsReading | null) =>
  lords === null
    ? LORDS
    : typeof lords === "number"
      ? `${LORDS} ${formatShort(lords)}`
      : `${LORDS}: ${lords === "failed" ? REALM_CARD_WORDS.lordsUnread : REALM_CARD_WORDS.lordsReading}`;
