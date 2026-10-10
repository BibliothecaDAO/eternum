// The client deploy's L2 must be the identity Worker's for the same environment: the Worker verifies wallet proofs and
// reads the ledger link on its checked-in L2_CHAIN_ID (apps/realms/wrangler.jsonc), and a client on another chain
// would have every proof and paid entry refused. Run before the build and the upload:
//   node apps/game/scripts/check-l2-chain-matches-identity.mjs <environment> <client chain>
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WRANGLER = new URL("../../realms/wrangler.jsonc", import.meta.url);

/** The identity Worker's L2_CHAIN_ID for an environment, read from its commented config; undefined when it has none. */
export const identityChainOf = (jsonc, environment) =>
  JSON.parse(withoutComments(jsonc)).env?.[environment]?.vars?.L2_CHAIN_ID;

/** Why the client's chain differs from the Worker's for this environment, or null when they agree. */
export const l2ChainMismatch = (jsonc, environment, clientChain) => {
  const identityChain = identityChainOf(jsonc, environment);
  if (identityChain === undefined) return `the identity Worker has no L2_CHAIN_ID for ${environment}`;
  return identityChain === clientChain
    ? null
    : `the client would build for ${clientChain} but the identity Worker's ${environment} is on ${identityChain}`;
};

/** JSONC to JSON: comments and trailing commas go; anything inside a string stays. */
const withoutComments = (text) => {
  let out = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === "\\" ? 2 : 1;
      out += text.slice(i, end + 1);
      i = end;
    } else if (char === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
    } else if (char === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
    } else out += char;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [environment, clientChain] = process.argv.slice(2);
  const mismatch = l2ChainMismatch(readFileSync(WRANGLER, "utf8"), environment, clientChain);
  if (mismatch) {
    console.error(`::error::${mismatch}; set CLIENT_L2_CHAIN to match before deploying`);
    process.exit(1);
  }
  console.log(`client and identity Worker share ${clientChain} on ${environment}`);
}
