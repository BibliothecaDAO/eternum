import { argent, braavos, type Connector, type UseInjectedConnectorsProps } from "@starknet-react/core";

type InjectedConnectorOptions = Required<
  Pick<UseInjectedConnectorsProps, "recommended" | "includeRecommended" | "order">
>;

export const getInjectedConnectorsOptions = (): InjectedConnectorOptions => ({
  recommended: [argent(), braavos()],
  includeRecommended: "always",
  order: "random",
});

export const buildStarknetConnectors = (
  cartridgeConnector: Connector,
  injectedConnectors: Connector[],
  onlyCartridge = false,
): Connector[] => [cartridgeConnector, ...(onlyCartridge ? [] : injectedConnectors)];
