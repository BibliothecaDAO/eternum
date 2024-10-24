import Controller from "@cartridge/controller";
import { Connector } from "@starknet-react/core";

import { policies } from "./policies";

export const getConnectors = (): { connectors: Connector[] } => {
  const theme: string = "eternum";

  const paymaster = { caller: "0x414e595f43414c4c4552" };
  const rpc = import.meta.env.VITE_PUBLIC_NODE_URL;

  const cartridge = new Controller({
    rpc,
    policies,
    paymaster,
    theme,
  }) as never as Connector;

  return { connectors: [cartridge] };
};
