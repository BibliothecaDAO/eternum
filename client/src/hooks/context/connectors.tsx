import ControllerConnector from "@cartridge/connector/controller";
import { Connector } from "@starknet-react/core";
import { policies } from "./policies";

export const getConnectors = (): { connectors: Connector[] } => {
  const theme: string = "eternum";

  const rpc = import.meta.env.VITE_PUBLIC_NODE_URL;

  const cartridge = new ControllerConnector({
    rpc,
    policies,
    theme,
  }) as never as Connector;

  return { connectors: [cartridge] };
};
