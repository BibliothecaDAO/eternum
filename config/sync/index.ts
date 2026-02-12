import { saveConfigJsonFromConfigTsFile, type NetworkType } from "../utils/environment";

const { VITE_PUBLIC_CHAIN } = process.env;

if (!VITE_PUBLIC_CHAIN) {
  console.error("Error: VITE_PUBLIC_CHAIN environment variable is not set");
  process.exit(1);
}

console.log(`\n🔄 Syncing configuration JSON for ${VITE_PUBLIC_CHAIN}...\n`);

await saveConfigJsonFromConfigTsFile(VITE_PUBLIC_CHAIN as NetworkType);

console.log(`✅ Configuration JSON updated successfully for ${VITE_PUBLIC_CHAIN}\n`);
