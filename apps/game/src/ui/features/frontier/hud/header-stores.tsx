import "./frontier-bar.css";

import { Icon } from "@/ui/design-system/icon";
import { SHOP_WORDS } from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import {
  LandingDelta,
  STORE_TONES,
  storeCapacityShare,
  storeLine,
  storeRateText,
  type StoreReading,
} from "./status-strip";

export const TOP_BAR_STORE_KINDS: readonly StoreKind[] = ["essence", "labor", "wheat", "troops"];

export const pickStores = (stores: readonly StoreReading[], kinds: readonly StoreKind[]): StoreReading[] =>
  kinds
    .map((kind) => stores.find((store) => store.kind === kind))
    .filter((store): store is StoreReading => store !== undefined);

export const StoreLiquidFill = ({ store }: { store: StoreReading }) => {
  const share = storeCapacityShare(store);
  if (share === undefined) return null;
  return (
    <span
      className="frontier-store-liquid"
      data-store={store.kind}
      data-tone={STORE_TONES[store.tone].meter}
      data-fill-share={String(Math.round(share * 100))}
      style={{ width: `${share * 100}%` }}
      aria-hidden="true"
    />
  );
};

export const FragmentsSocket = ({
  fragments,
  onShop,
  compact = false,
}: {
  fragments: number | null;
  onShop?: () => void;
  compact?: boolean;
}) => {
  if (fragments === null || !onShop) return null;
  const label = SHOP_WORDS.fragments(fragments);
  return (
    <button
      type="button"
      data-fragments-socket=""
      data-compact={compact || undefined}
      aria-label={label}
      data-tip={label}
      className="frontier-fragments-socket pointer-events-auto"
      onClick={onShop}
    >
      <span className="frontier-fragments-socket__icon" aria-hidden="true">
        <Icon name="fragment" size={compact ? 18 : 22} />
      </span>
      <span className="frontier-fragments-socket__amount">{formatShort(fragments)}</span>
      <span className="frontier-fragments-socket__plus" aria-hidden="true">
        +
      </span>
    </button>
  );
};

export const HeaderStores = ({
  stores,
  storeCards,
  showPopoverCard,
  fragments = null,
  onShop,
}: {
  stores: readonly StoreReading[];
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  showPopoverCard: boolean;
  fragments?: number | null;
  onShop?: () => void;
}) => {
  const listed = pickStores(stores, TOP_BAR_STORE_KINDS);
  const hasFragments = fragments !== null && Boolean(onShop);
  if (listed.length === 0 && !hasFragments) return null;
  return (
    <div className="frontier-stores-wrap">
      <div role="group" aria-label="Stores" className="frontier-stores">
        {listed.map((store) => (
          <BarStoreTrough
            key={store.kind}
            store={store}
            onToggle={storeCards?.kinds.includes(store.kind) ? () => storeCards.onToggle(store.kind) : undefined}
          />
        ))}
        {listed.length > 0 && hasFragments && <span className="frontier-cornice-rivet" aria-hidden="true" />}
        <FragmentsSocket fragments={fragments} onShop={onShop} />
      </div>
      {showPopoverCard && storeCards?.open && storeCards.card && (
        <div className="frontier-store-popover">{storeCards.card}</div>
      )}
    </div>
  );
};

const BarStoreTrough = ({ store, onToggle }: { store: StoreReading; onToggle?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const meta = FRONTIER_STORES[store.kind];
  const line = storeLine(store);
  const rate = storeRateText(store);
  const content = (
    <>
      <LandingDelta target={store.flyTarget} />
      <span data-fly-target={store.flyTarget} className="frontier-trough__icon">
        <Icon name={meta.icon} size={24} />
      </span>
      <span className="frontier-trough__well">
        <StoreLiquidFill store={store} />
        <span className="frontier-trough__values">
          <span className={STORE_TONES[store.tone].text}>
            {shown === undefined ? "—" : <TickNumber value={shown} format={formatShort} />}
          </span>
          {rate && (
            <span className="frontier-trough__rate">
              {rate.endsWith("/min") ? (
                <>
                  {rate.slice(0, -4)}
                  <span className="frontier-trough__rate-unit">/min</span>
                </>
              ) : (
                rate
              )}
            </span>
          )}
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
      className="frontier-trough"
      onClick={onToggle}
    >
      {content}
    </button>
  ) : (
    <span data-store={store.kind} role="img" aria-label={line} data-tip={line} className="frontier-trough">
      {content}
    </span>
  );
};
