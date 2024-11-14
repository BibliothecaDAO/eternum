import { useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "../ui/button";

import { useDojo } from "@/hooks/context/DojoContext";
import { displayAddress } from "@/lib/utils";
import { TypeH1 } from "../typography/type-h1";
import { ModeToggle } from "./mode-toggle";

export const TopNavigation = () => {
  const {
    account: { account },
  } = useDojo();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-2">
        {/* <SidebarTrigger /> */}
        <TypeH1>Season 0</TypeH1>
      </div>
      <div className="flex gap-2">
        <ModeToggle />
        {/* {!account?.address ? ( */}
        <>
          {connectors.map((connector, index) => (
            <Button key={index} onClick={() => connect({ connector })} variant="cta">
              <img className="w-5" src={typeof connector.icon === "string" ? connector.icon : connector.icon.dark} />{" "}
              Connect {connector.name}
            </Button>
          ))}
        </>
        {/* // ) : (
        //   <Button onClick={() => disconnect()}>{displayAddress(account?.address)}</Button>
        // )} */}
        <Button onClick={() => disconnect()}>{displayAddress(account?.address)}</Button>
      </div>
    </div>
  );
};
