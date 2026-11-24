import type { StoreKind } from "../stores";
import type { StoreReading } from "./status-strip";

export const pickStores = (stores: readonly StoreReading[], kinds: readonly StoreKind[]): StoreReading[] =>
  kinds
    .map((kind) => stores.find((store) => store.kind === kind))
    .filter((store): store is StoreReading => store !== undefined);
