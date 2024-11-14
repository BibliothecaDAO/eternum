import { useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "../ui/button";

import { useDojo } from "@/hooks/context/DojoContext";
import { displayAddress } from "@/lib/utils";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";

export const TopNavigation = () => {
  const {
    account: { account },
  } = useDojo();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex justify-between items-center w-full p-2">
      <div className="flex items-center">
        <SidebarTrigger />
      </div>
      <div className="flex gap-2">
        <ModeToggle />
        {/* {!account?.address ? ( */}
        <>
          {connectors.map((connector, index) => (
            <Button size={"default"} key={index} onClick={() => connect({ connector })} variant="outline">
              <img className="w-5" src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark} />{" "}
            </Button>
          ))}
        </>
        {/* // ) : (
        //   <Button onClick={() => disconnect()}>{displayAddress(account?.address)}</Button>
        // )} */}
        <Button size={"default"} onClick={() => disconnect()}>
          {displayAddress(account?.address)}
        </Button>
      </div>
    </div>
  );
};
