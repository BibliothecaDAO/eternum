import { readFileSync } from "node:fs";
import { hash } from "starknet";
import playerAccount from "./class-hash.json";

/** The service pin must describe the compiled account that the release will deploy. */
export function checkAccountClass(artifactPath: string | URL, pinnedHash: string) {
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const builtHash = hash.computeSierraContractClassHash(artifact);
  if (BigInt(builtHash) !== BigInt(pinnedHash))
    throw new Error(
      `Player account class differs: built ${builtHash}, pinned ${pinnedHash}. Update contracts/l3/player-account/class-hash.json before landing.`,
    );
}

if (import.meta.main) {
  checkAccountClass(
    new URL("./target/dev/realms_player_account_RealmsAccount.contract_class.json", import.meta.url),
    playerAccount.accountClassHash,
  );
}
