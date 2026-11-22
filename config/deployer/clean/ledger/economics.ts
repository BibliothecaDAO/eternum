import { chestPresets } from "../../../../contracts/l2/ledger/scripts/chest-preset.js";
import environments from "../../../../deploy/first/environments.json";

/** The chest rewards an environment registers, named by its `chests` in environments.json; an unknown name refuses. */
export function chestPresetFor(environment: keyof typeof environments) {
  const name = environments[environment].chests;
  const build = chestPresets[name as keyof typeof chestPresets];
  if (!build) throw new Error(`Unknown chest preset ${name}`);
  return build();
}
