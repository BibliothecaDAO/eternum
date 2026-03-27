import "dotenv/config";
import { Account, RpcProvider } from "starknet";

const NETWORKS = {
  local: {
    explorer_url: "http://localhost:3001",
    name: "local",
    rpc_url: process.env.STARKNET_RPC,
  },
  slot: {
    explorer_url: "https://slot.voyager.online",
    name: "slot",
    rpc_url: process.env.STARKNET_RPC,
  },
  slottest: {
    explorer_url: "https://slot.voyager.online",
    name: "slottest",
    rpc_url: process.env.STARKNET_RPC,
  },
  sepolia: {
    explorer_url: "https://sepolia.voyager.online",
    name: "sepolia",
    rpc_url: process.env.STARKNET_RPC,
  },
  mainnet: {
    explorer_url: "https://voyager.online",
    name: "mainnet",
    rpc_url: process.env.STARKNET_RPC,
  },
};

export const getNetwork = (network) => {
  const selectedNetwork = NETWORKS[network.toLowerCase()];

  if (!selectedNetwork) {
    throw new Error(`Network ${network} not found`);
  }

  return selectedNetwork;
};

export const getProvider = () => {
  const network = getNetwork(process.env.STARKNET_NETWORK);
  return new RpcProvider({ nodeUrl: network.rpc_url });
};

export const getAccount = () => {
  const provider = getProvider();
  return new Account({
    address: process.env.STARKNET_ACCOUNT_ADDRESS,
    provider,
    signer: process.env.STARKNET_ACCOUNT_PRIVATE_KEY,
  });
};
