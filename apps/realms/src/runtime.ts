import { Layer, ManagedRuntime } from "effect";

import { HeraldClient } from "./services/herald";
import { IdentityApi } from "./services/identity";
import { LedgerClient } from "./services/ledger";
import { MmrClient } from "./services/mmr";
import { Rpc } from "./services/platform/rpc";
import { Wallet } from "./services/platform/wallet";

/** One runtime for the whole app; composing this layer is the whole wiring. */
const MainLayer = Layer.mergeAll(
  Rpc.Default,
  Wallet.Default,
  HeraldClient.Default,
  LedgerClient.Default,
  MmrClient.Default,
  IdentityApi.Default,
);

export const runtime = ManagedRuntime.make(MainLayer);
export type AppServices = Layer.Layer.Success<typeof MainLayer>;
