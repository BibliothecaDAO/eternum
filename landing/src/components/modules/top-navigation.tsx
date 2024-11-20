import { useConnect, useDisconnect } from "@starknet-react/core";
import { Button } from "../ui/button";

import { lordsAddress } from "@/config";
import { useDojo } from "@/hooks/context/DojoContext";
import { useLords } from "@/hooks/use-lords";
import { displayAddress } from "@/lib/utils";
import { Uint256, uint256 } from "starknet";
import { formatEther } from "viem";
import { SidebarTrigger } from "../ui/sidebar";
import { ModeToggle } from "./mode-toggle";

export const TopNavigation = () => {
  const {
    account: { account },
    setup: {
      systemCalls: { mint_test_lords },
    },
  } = useDojo();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const { lordsBalance } = useLords();

  return (
    <div className="flex justify-between items-center w-full p-2">
      <div className="flex items-center">
        <SidebarTrigger />
      </div>
      <div className="flex gap-2">
        <ModeToggle />

        {lordsBalance ? (
          <div className="text-sm p-2 rounded border">
            {formatEther(uint256.uint256ToBN(lordsBalance as Uint256))} Lords
          </div>
        ) : null}

        <Button onClick={async () => await mint_test_lords({ signer: account, lords_address: lordsAddress })}>
          Mint Test Lords
        </Button>

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
