import CartridgeIcon from "@/assets/icons/cartridge-small.svg?react";
import { argent, braavos, useAccount, useConnect, useInjectedConnectors } from "@starknet-react/core";
import { useEffect } from "react";
import { TypeH2 } from "../typography/type-h2";
import { Button } from "../ui/button";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";

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
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <TypeH2>Season 0</TypeH2>
      </div>
      <div className="flex gap-2">
        <ModeToggle />
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
