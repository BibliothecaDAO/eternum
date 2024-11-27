import { displayAddress } from "@/lib/utils";
import ControllerConnector from "@cartridge/connector/controller";
import { sepolia } from "@starknet-react/chains";
import { jsonRpcProvider, StarknetConfig, useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useCallback, useEffect, useState } from "react";
import { Button, ButtonProps } from "../ui/button";

const theme: string = "eternum";
const slot: string = "eternum-rc1-1";
const namespace: string = "eternum";
const colorMode = "dark";

const cartridgeController = new ControllerConnector({
  policies: [],
  rpc: "https://api.cartridge.gg/x/starknet/sepolia",
  theme,
  colorMode,
  namespace,
  slot,
});

export const CartridgeConnectButton = (props: ButtonProps) => {
  const { connect, connectors } = useConnect();

  const rpc = useCallback(() => {
    return { nodeUrl: import.meta.env.VITE_PUBLIC_NODE_URL };
  }, []);
  return (
    <StarknetConfig chains={[sepolia]} provider={jsonRpcProvider({ rpc })} connectors={[cartridgeController]}>
      <UserButton {...props} />
    </StarknetConfig>
  );
};

export const UserButton = (props: ButtonProps) => {
  const { connect, connectors } = useConnect();
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const [username, setUsername] = useState<string>();
  const controller = connectors[0] as ControllerConnector;

  useEffect(() => {
    if (!address) return;
    controller.username()?.then((n) => setUsername(n));
  }, [address, controller]);

  return (
    <>
      {address ? (
        <Button variant="outline" onClick={() => disconnect()} {...props}>
          <div className="flex !flex-col">
            <span>{username}</span>
            <span className="text-xs">{displayAddress(address)}</span>
          </div>
        </Button>
      ) : (
        <Button variant="cta" onClick={() => connect({ connector: connectors[0] })} {...props}>
          <img className="w-6" src={connectors[0].icon as string} /> {props.children ?? "Log In"}
        </Button>
      )}
    </>
  );
};
