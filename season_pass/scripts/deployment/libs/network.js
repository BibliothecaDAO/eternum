import "dotenv/config";
import { Account, RpcProvider } from "starknet";

const NETWORKS = {
  mainnet: {
    name: "mainnet",
    explorer_url: "https://voyager.online",
    rpc_url: `${process.env.RPC_API_KEY}`,
    feeder_gateway_url: "https://alpha-mainnet.starknet.io/feeder_gateway",
    gateway_url: "https://alpha-mainnet.starknet.io/gateway",
  },
  sepolia: {
    name: "sepolia",
    explorer_url: "https://sepolia.voyager.online",
    rpc_url: `https://free-rpc.nethermind.io/sepolia-juno`,
    feeder_gateway_url: "https://alpha-sepolia.starknet.io/feeder_gateway",
    gateway_url: "https://alpha-sepolia.starknet.io/gateway",
  },
  local: {
    name: "local",
    explorer_url: "http://127.0.0.1:8000",
    rpc_url: `http://127.0.0.1:5050`,
    feeder_gateway_url: "http://127.0.0.1:5050/feeder_gateway",
    gateway_url: "http://127.0.0.1:5050/gateway",
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
  const cairoVersion = "1";
  return new Account(provider, accountAddress, privateKey, cairoVersion);
};
