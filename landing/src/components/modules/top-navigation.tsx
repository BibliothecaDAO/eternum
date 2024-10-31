import { useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "../ui/button";

import useAccountOrBurner from "@/hooks/useAccountOrBurner";
import { displayAddress } from "@/lib/utils";
import { TypeH2 } from "../typography/type-h2";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";

export const TopNavigation = () => {
  const { account } = useAccountOrBurner();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  /*useEffect(() => {
    if (status === "disconnected") {
      // on disconnect
    } else if (status === "connected") {
      // on connect
    }
  }, [address, status]);*/

  /*const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "onlyIfNoConnectors",
    order: "random",
  });*/

  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <TypeH2>Season 0</TypeH2>
      </div>
      <div className="flex gap-2">
        <ModeToggle />
        {!account?.address ? (
          <>
            {connectors.map((connector, index) => (
              <Button key={index} onClick={() => connect({ connector })} variant="cta">
                <img className="w-5" src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark} />{" "}
                Connect {connector.name}
              </Button>
            ))}
          </>
        ) : (
          <Button onClick={() => disconnect}>{displayAddress(account?.address)}</Button>
        )}
      </div>
    </div>
  );
};
