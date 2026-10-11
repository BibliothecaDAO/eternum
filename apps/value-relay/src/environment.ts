import { environmentL2, valuePlaneAddress, type ValueEnvironment } from "@realms-world/chain";
import { Schema } from "effect";

/** Relay and monitor use the same deployed address book as the client. */
export const ledgerAddress = (environment: ValueEnvironment) => valuePlaneAddress("ledger", environment);

const RelayVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  BASE_URL: Schema.NonEmptyString,
  L2_RPC_URL: Schema.NonEmptyString,
  OPERATOR_TOKEN: Schema.NonEmptyString,
  SHARD_LEDGER_OPERATOR_PRIVATE_KEY: Schema.NonEmptyString,
  LEDGER_OPERATOR_ADDRESS: Schema.NonEmptyString,
  LEDGER_OPERATOR_PRIVATE_KEY: Schema.NonEmptyString,
});
export type RelaySettings = Schema.Schema.Type<typeof RelayVars>;
const decodeRelayVars = Schema.decodeUnknownSync(RelayVars, { onExcessProperty: "ignore" });
export function decodeRelaySettings(raw: unknown): RelaySettings {
  try {
    const vars = decodeRelayVars(raw);
    environmentL2(vars.ENVIRONMENT);
    if (new URL(vars.L2_RPC_URL).protocol !== "https:" || new URL(vars.BASE_URL).protocol !== "https:")
      throw new Error();
    return vars;
  } catch {
    throw new Error("relay_environment_invalid");
  }
}
