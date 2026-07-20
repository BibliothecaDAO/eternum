import { checkResolvedConfigJson, saveResolvedConfigJson, type GameType, type NetworkType } from "../utils/environment";

const CHAINS: readonly NetworkType[] = ["local", "sepolia", "slot", "slottest", "mainnet"];
const GAME_TYPES: readonly GameType[] = ["blitz", "eternum"];
const AMBIENT_GENERATION_INPUTS = [
  "CONFIG_START_SETTLING_AT",
  "CONFIG_START_MAIN_AT",
  "VITE_PUBLIC_VRF_PROVIDER_ADDRESS",
] as const;

export async function generateResolvedConfigs(checkOnly = false): Promise<void> {
  assertNoAmbientGenerationInputs();
  for (const chain of CHAINS) {
    for (const gameType of GAME_TYPES) {
      if (checkOnly) {
        await checkResolvedConfigJson(chain, gameType);
      } else {
        await saveResolvedConfigJson(chain, gameType);
      }
    }
  }
}

function assertNoAmbientGenerationInputs(): void {
  const configuredInput = AMBIENT_GENERATION_INPUTS.find((key) => process.env[key] !== undefined);
  if (configuredInput) {
    throw new Error(`${configuredInput} is a runtime override and cannot influence committed config generation`);
  }
}

generateResolvedConfigs(process.argv.includes("--check")).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
