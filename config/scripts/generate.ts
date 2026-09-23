import fs from "node:fs";
import type { ConfigurationNetwork } from "../shared/game-environments";
import {
  renderResolvedConfigJson,
  resolvedConfigPath,
  saveResolvedConfigJson,
  type GameType,
} from "../utils/environment";

/** Every config the deployer and client read from config/generated (see config/utils/utils.ts). */
const GENERATED_CONFIGS: ReadonlyArray<{ chain: ConfigurationNetwork; gameType: GameType }> = [
  { chain: "madara", gameType: "blitz" },
  { chain: "madara", gameType: "duel" },
  { chain: "madara", gameType: "eternum" },
  { chain: "madara", gameType: "frontier" },
];

/** Names the generated configs that differ from what the config source composes today. */
async function findStaleConfigs(): Promise<string[]> {
  const stale: string[] = [];
  for (const { chain, gameType } of GENERATED_CONFIGS) {
    const target = resolvedConfigPath(chain, gameType);
    const committed = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    if (committed !== (await renderResolvedConfigJson(chain, gameType))) stale.push(target);
  }
  return stale;
}

async function writeGeneratedConfigs(): Promise<void> {
  for (const { chain, gameType } of GENERATED_CONFIGS) {
    await saveResolvedConfigJson(chain, gameType);
    console.log(`Generated ${resolvedConfigPath(chain, gameType)}`);
  }
}

if (process.argv.includes("--check")) {
  const stale = await findStaleConfigs();
  if (stale.length > 0) {
    console.error(`Generated configs differ from config/source; run pnpm run config:generate:\n${stale.join("\n")}`);
    process.exit(1);
  }
  console.log("Generated configs match config/source");
} else {
  await writeGeneratedConfigs();
}
