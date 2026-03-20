import { EternumProvider } from "@bibliothecadao/provider";
import { getGameManifest } from "@contracts";
import { Account } from "starknet";
import { confirmNonLocalDeployment } from "../utils/confirmation";
import { logNetwork, saveResolvedConfigJson, type GameType, type NetworkType } from "../utils/environment";
import { type Chain } from "../utils/utils";

const VALID_GAME_TYPES: GameType[] = ["blitz", "eternum"];

export interface QuestCommandContext {
  account: Account;
  gameType: GameType;
  network: NetworkType;
  provider: EternumProvider;
}

export function resolveQuestGameTypeArg(argv: string[]): GameType {
  const gameType = argv[2] as GameType;

  if (!gameType || !VALID_GAME_TYPES.includes(gameType)) {
    console.error("Usage: bun run ./scripts/<command>.ts <game_type>");
    console.error(`  game_type must be one of: ${VALID_GAME_TYPES.join(", ")}`);
    process.exit(1);
  }

  return gameType;
}

export async function createQuestCommandContext(gameType: GameType): Promise<QuestCommandContext> {
  const network = process.env.VITE_PUBLIC_CHAIN as NetworkType;
  const accountAddress = process.env.VITE_PUBLIC_MASTER_ADDRESS;
  const privateKey = process.env.VITE_PUBLIC_MASTER_PRIVATE_KEY;
  const nodeUrl = process.env.VITE_PUBLIC_NODE_URL;
  const vrfProviderAddress = process.env.VITE_PUBLIC_VRF_PROVIDER_ADDRESS;

  confirmNonLocalDeployment(network);
  await saveResolvedConfigJson(network, gameType);
  logNetwork(network);

  const manifest = await getGameManifest(network as Chain);
  const provider = new EternumProvider(manifest, nodeUrl, vrfProviderAddress);
  const account = new Account({
    provider: provider.provider,
    address: accountAddress,
    signer: privateKey,
  });

  return {
    account,
    gameType,
    network,
    provider,
  };
}
