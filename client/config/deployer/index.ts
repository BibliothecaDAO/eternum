import {
  EternumProvider
} from "@bibliothecadao/eternum";
import { Account } from "starknet";
import { getGameManifest } from "../../common/utils";
import { confirmNonLocalDeployment } from "../utils/confirmation";
import { getConfigFromNetwork, logNetwork, type NetworkType } from "../utils/environment";
import { GameConfigDeployer } from "./config";

const {
  VITE_PUBLIC_MASTER_ADDRESS,
  VITE_PUBLIC_MASTER_PRIVATE_KEY,
  VITE_PUBLIC_NODE_URL,
  VITE_PUBLIC_CHAIN,
  VITE_PUBLIC_VRF_PROVIDER_ADDRESS,
} = process.env;

// =============== SETUP ETERNUM CONFIG ===============

// prompt user to confirm non-local deployment
confirmNonLocalDeployment(VITE_PUBLIC_CHAIN!);

const manifest = await getGameManifest(VITE_PUBLIC_CHAIN!);
const provider = new EternumProvider(manifest, VITE_PUBLIC_NODE_URL, VITE_PUBLIC_VRF_PROVIDER_ADDRESS);
const account = new Account(provider.provider, VITE_PUBLIC_MASTER_ADDRESS!, VITE_PUBLIC_MASTER_PRIVATE_KEY!);
const configuration = await getConfigFromNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
export const config = new GameConfigDeployer(configuration);

// Deploy configurations
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);
await config.setupAll(account, provider);
logNetwork(VITE_PUBLIC_CHAIN! as NetworkType);



