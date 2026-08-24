export const STARKNET_STREAM_NETWORKS = ["sepolia", "mainnet"] as const;

export type StarknetStreamNetwork = (typeof STARKNET_STREAM_NETWORKS)[number];

function unsupportedNetwork(network: never): never {
  throw new Error(`Unsupported Starknet stream network: ${String(network)}`);
}

export function getStarknetStreamUrl(chain: StarknetStreamNetwork) {
  switch (chain) {
    case "mainnet":
      return "https://mainnet.starknet.a5a.ch";
    case "sepolia":
      return "https://sepolia.starknet.a5a.ch";
    default:
      return unsupportedNetwork(chain);
  }
}

export function getEthereumStreamUrl(chain: StarknetStreamNetwork) {
  switch (chain) {
    case "mainnet":
      return "https://mainnet.ethereum.a5a.ch";
    case "sepolia":
      throw new Error(
        "No default Ethereum Sepolia DNA stream is available. Set APIBARA_ETHEREUM_STREAM_URL to a provisioned endpoint.",
      );
    default:
      return unsupportedNetwork(chain);
  }
}
