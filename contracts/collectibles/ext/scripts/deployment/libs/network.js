import "dotenv/config";
import { Account, RpcProvider } from "starknet";

const NETWORKS = {
  mainnet: {
    name: "mainnet",
    explorer_url: "https://voyager.online",
    rpc_url: process.env.STARKNET_RPC,
    feeder_gateway_url: "https://alpha-mainnet.starknet.io/feeder_gateway",
    gateway_url: "https://alpha-mainnet.starknet.io/gateway",
  },
  sepolia: {
    name: "sepolia",
    explorer_url: "https://sepolia.voyager.online",
    rpc_url: process.env.STARKNET_RPC,
    feeder_gateway_url: "https://alpha-sepolia.starknet.io/feeder_gateway",
    gateway_url: "https://alpha-sepolia.starknet.io/gateway",
  },
  local: {
    name: "local",
    explorer_url: "http://localhost:3001",
    rpc_url: process.env.STARKNET_RPC,
    feeder_gateway_url: process.env.STARKNET_RPC + "/feeder_gateway",
    gateway_url: process.env.STARKNET_RPC + "/gateway",
  },
  slot: {
    name: "slot",
    explorer_url: "https://slot.voyager.online",
    rpc_url: process.env.STARKNET_RPC,
    feeder_gateway_url: process.env.STARKNET_RPC + "/feeder_gateway",
    gateway_url: process.env.STARKNET_RPC + "/gateway",
  },
};

export const getNetwork = (network) => {
  if (!NETWORKS[network.toLowerCase()]) {
    throw new Error(`Network ${network} not found`);
  }
  return NETWORKS[network.toLowerCase()];
};

export const getProvider = () => {
  let network = getNetwork(process.env.STARKNET_NETWORK);
  return new RpcProvider({ nodeUrl: network.rpc_url });
};

export const getAccount = () => {
  const provider = getProvider();
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;
  const privateKey = process.env.STARKNET_ACCOUNT_PRIVATE_KEY;
  return new Account({provider, address: accountAddress, signer: privateKey});
};
