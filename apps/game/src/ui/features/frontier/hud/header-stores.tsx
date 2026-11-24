import "./frontier-bar.css";

import { Icon } from "@/ui/design-system/icon";
import { SHOP_WORDS } from "@/ui/design-system/kit/words";
import { formatShort } from "@bibliothecadao/types";

import type { StoreKind } from "../stores";
import { STORE_TONES, storeCapacityShare, type StoreReading } from "./status-strip";

export const TOP_BAR_STORE_KINDS: readonly StoreKind[] = ["essence", "labor", "wheat", "troops"];

export const pickStores = (stores: readonly StoreReading[], kinds: readonly StoreKind[]): StoreReading[] =>
  kinds
    .map((kind) => stores.find((store) => store.kind === kind))
    .filter((store): store is StoreReading => store !== undefined);

const StoreLiquidFill = ({ store }: { store: StoreReading }) => {
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
