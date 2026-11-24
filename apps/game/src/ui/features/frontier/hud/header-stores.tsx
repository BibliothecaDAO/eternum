import "./frontier-bar.css";

import { Icon } from "@/ui/design-system/icon";
import { SHOP_WORDS } from "@/ui/design-system/kit/words";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { LandingDelta, STORE_TONES, storeLine, type StoreReading } from "./status-strip";

const REALM_STORE_KINDS: readonly StoreKind[] = ["labor", "wheat"];
const BAR_STORE_KINDS: readonly StoreKind[] = [...REALM_STORE_KINDS, "essence"];

export const pickStores = (stores: readonly StoreReading[], kinds: readonly StoreKind[]): StoreReading[] =>
  kinds
    .map((kind) => stores.find((store) => store.kind === kind))
    .filter((store): store is StoreReading => store !== undefined);

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
  const listed = pickStores(stores, BAR_STORE_KINDS);
  if (listed.length === 0 && (fragments === null || !onShop)) return null;
  const fragmentsLabel = fragments === null ? undefined : SHOP_WORDS.fragments(fragments);
  return (
    <div className="frontier-stores-wrap">
      <div role="group" aria-label="Stores" className="frontier-stores">
        {listed.map((store) => (
          <BarStoreItem
            key={store.kind}
            store={store}
            onToggle={storeCards?.kinds.includes(store.kind) ? () => storeCards.onToggle(store.kind) : undefined}
          />
        ))}
        {fragments !== null && onShop && fragmentsLabel && (
          <button
            type="button"
            aria-label={fragmentsLabel}
            data-tip={fragmentsLabel}
            className="frontier-store"
            onClick={onShop}
          >
            <Icon name="fragment" size={16} />
            <span>{formatShort(fragments)}</span>
          </button>
        )}
      </div>
      {showPopoverCard && storeCards?.open && storeCards.card && (
        <div className="frontier-store-popover">{storeCards.card}</div>
      )}
    </div>
  );
};

const BarStoreItem = ({
  store,
  iconSize = 16,
  onToggle,
}: {
  store: StoreReading;
  iconSize?: number;
  onToggle?: () => void;
}) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const meta = FRONTIER_STORES[store.kind];
  const line = storeLine(store);
  const content = (
    <>
      <LandingDelta target={store.flyTarget} />
      <span data-fly-target={store.flyTarget} className="inline-flex shrink-0">
        <Icon name={meta.icon} size={iconSize} />
      </span>
      <span className={STORE_TONES[store.tone].text}>
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
      className="frontier-store"
      onClick={onToggle}
    >
      {content}
    </button>
  ) : (
    <span data-store={store.kind} role="img" aria-label={line} data-tip={line} className="frontier-store">
      {content}
    </span>
  );
};
