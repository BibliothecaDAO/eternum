import { Effect } from "effect";
import { valuePlaneAddress, type ValuePlaneContract } from "@realms-world/chain";

import { ValuePlaneNotDeployed } from "./errors";

/** Mainnet address of a value-plane contract, or a typed failure until it is deployed. */
export const contractAddress = (contract: ValuePlaneContract): Effect.Effect<string, ValuePlaneNotDeployed> =>
  Effect.try({
    try: () => valuePlaneAddress(contract),
    catch: () => new ValuePlaneNotDeployed({ contract }),
  });
