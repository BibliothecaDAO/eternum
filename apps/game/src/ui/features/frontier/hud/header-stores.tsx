import "./frontier-bar.css";

import { Icon } from "@/ui/design-system/icon";
import { useLandedValue } from "@/ui/motion/landing-hold";
import { TickNumber } from "@/ui/motion/tick-number";
import { formatShort } from "@bibliothecadao/types";
import type { ReactNode } from "react";

import { FRONTIER_STORES, type StoreKind } from "../stores";
import { STORE_TONES, storeLine, type StoreReading } from "./status-strip";

const BAR_STORE_KINDS: readonly StoreKind[] = ["labor", "wheat", "essence"];

export const HeaderStores = ({
  stores,
  storeCards,
  showPopoverCard,
}: {
  stores: readonly StoreReading[];
  storeCards?: {
    kinds: readonly StoreReading["kind"][];
    open: StoreReading["kind"] | null;
    onToggle: (kind: StoreReading["kind"]) => void;
    card: ReactNode;
  };
  showPopoverCard: boolean;
}) => {
  const listed = BAR_STORE_KINDS.map((kind) => stores.find((store) => store.kind === kind)).filter(
    (store): store is StoreReading => store !== undefined,
  );
  if (listed.length === 0) return null;
  return (
    <div className="frontier-stores-wrap">
      <div role="group" aria-label="Stores" className="frontier-stores">
        {listed.map((store) => (
          <HeaderStoreItem
            key={store.kind}
            store={store}
            onToggle={storeCards?.kinds.includes(store.kind) ? () => storeCards.onToggle(store.kind) : undefined}
          />
        ))}
      </div>
      {showPopoverCard && storeCards?.open && storeCards.card && (
        <div className="frontier-store-popover">{storeCards.card}</div>
      )}
    </div>
  );
};

const HeaderStoreItem = ({ store, onToggle }: { store: StoreReading; onToggle?: () => void }) => {
  const shown = useLandedValue(store.flyTarget, store.amount);
  const meta = FRONTIER_STORES[store.kind];
  const line = storeLine(store);
  const content = (
    <>
      <Icon name={meta.icon} size={16} />
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
