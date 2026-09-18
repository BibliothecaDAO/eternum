import { Layer, ManagedRuntime } from "effect";

import { HeraldClient } from "./services/herald";
import { IdentityApi } from "./services/identity";
import { PlaytestClient } from "./services/playtest";
import { MmrClient } from "./services/mmr";
import { Rpc } from "./services/platform/rpc";
import { Wallet } from "./services/platform/wallet";

/** One runtime for the whole app; composing this layer is the whole wiring. */
const MainLayer = Layer.mergeAll(
  Rpc.layer,
  Wallet.layer,
  HeraldClient.layer,
  PlaytestClient.layer,
  MmrClient.layer,
  IdentityApi.layer,
);

export const runtime = ManagedRuntime.make(MainLayer);
export type AppServices = Layer.Success<typeof MainLayer>;
