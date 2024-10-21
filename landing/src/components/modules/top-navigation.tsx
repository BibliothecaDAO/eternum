import { argent, braavos, useAccount, useConnect, useInjectedConnectors } from "@starknet-react/core";
import { TypeH1 } from "../typography/type-h1";
import { Button } from "../ui/button";

import CartridgeIcon from "@/assets/icons/cartridge-small.svg?react";
import { useEffect } from "react";

export const TopNavigation = () => {
  const { address, status } = useAccount();
  const { connect } = useConnect({});

  useEffect(() => {
    if (status === "disconnected") {
      // on disconnect
    } else if (status === "connected") {
      // on connect
    }
  }, [address, status]);

  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "random",
  });

  return (
    <div className="flex justify-between items-center w-full">
      <TypeH1>Season 0</TypeH1>
      <div className="flex gap-2">
        <Button variant="cta">
          <CartridgeIcon /> Login
        </Button>
        {connectors.map((connector, index) => (
          <Button key={index} onClick={() => connect({ connector })} variant="cta">
            {" "}
            Connect {connector.name}
          </Button>
        ))}
      </div>
    </div>
  );
};
