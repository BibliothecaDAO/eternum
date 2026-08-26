import type { GameChain } from "@realms-world/chain";
import * as fs from "node:fs";

import { resolveRepoPath } from "../shared/repo";

interface GameManifest {
  contracts?: Array<{ address?: string; tag?: string }>;
}

const isNonZeroAddress = (value: string | undefined): value is string => {
  if (!value) return false;
  return !/^0*$/.test(value.replace(/^0x/i, ""));
};

export const resolvePrizeDistributionAddress = (chain: GameChain): string => {
  const manifestPath = resolveRepoPath(`contracts/game/manifest_${chain}.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as GameManifest;
  const contract = manifest.contracts?.find(
    (candidate) => typeof candidate.tag === "string" && candidate.tag.includes("prize_distribution_systems"),
  );

  if (!isNonZeroAddress(contract?.address)) {
    throw new Error(`Could not resolve prize_distribution_systems from ${manifestPath}`);
  }

  return contract.address;
};
