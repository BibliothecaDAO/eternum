// The client builds for the identity Worker's L2: the Worker verifies wallet proofs and reads ledger links on its
// checked-in L2_CHAIN_ID (apps/realms/wrangler.jsonc), so the deploy reads that one value rather than naming the chain
// a second time. Prints SN_SEPOLIA or SN_MAIN:
//   node apps/game/scripts/identity-l2-chain.mjs <environment>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const WRANGLER = fileURLToPath(new URL("../../realms/wrangler.jsonc", import.meta.url));

/** The identity Worker's L2_CHAIN_ID for an environment, from its commented config; loud when it names none. */
export const identityChainOf = (jsonc, environment) => {
  const { config, error } = ts.parseConfigFileTextToJson("wrangler.jsonc", jsonc);
  if (error) throw new Error(`apps/realms/wrangler.jsonc does not parse: ${error.messageText}`);
  const chain = config.env?.[environment]?.vars?.L2_CHAIN_ID;
  if (chain !== "SN_SEPOLIA" && chain !== "SN_MAIN")
    throw new Error(`the identity Worker names no L2 (SN_SEPOLIA or SN_MAIN) for ${environment}`);
  return chain;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(identityChainOf(readFileSync(WRANGLER, "utf8"), process.argv[2]));
}
