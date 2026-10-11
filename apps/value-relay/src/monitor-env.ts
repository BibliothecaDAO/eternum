import { environmentL2 } from "@realms-world/chain";
import { Schema } from "effect";
const MonitorVars = Schema.Struct({
  ENVIRONMENT: Schema.Literals(["staging", "production"]),
  L2_RPC_URL: Schema.NonEmptyString,
  OPERATOR_TOKEN: Schema.NonEmptyString,
  PAUSER_ACCOUNT_ADDRESS: Schema.NonEmptyString,
  PAUSER_PRIVATE_KEY: Schema.NonEmptyString,
});
export type MonitorSettings = Schema.Schema.Type<typeof MonitorVars>;
const decodeMonitorVars = Schema.decodeUnknownSync(MonitorVars, { onExcessProperty: "ignore" });
export function decodeMonitorSettings(raw: unknown): MonitorSettings {
  try {
    const vars = decodeMonitorVars(raw);
    environmentL2(vars.ENVIRONMENT);
    if (new URL(vars.L2_RPC_URL).protocol !== "https:") throw new Error();
    return vars;
  } catch {
    throw new Error("monitor_environment_invalid");
  }
}
