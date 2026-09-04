import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-core";

export const getLastConnector = (connectors: WalletWithStarknetFeatures[]): WalletWithStarknetFeatures | null => {
  const lastWalletName = localStorage.getItem("starknetLastConnectedWallet");
  if (lastWalletName) {
    const connector = connectors.find((item) => item.name === lastWalletName);
    return connector ?? null;
  }
  return null;
};

export const getConnectorIcon = (connector: WalletWithStarknetFeatures | undefined) => {
  if (!connector) return "";
  return connector.icon;
};
