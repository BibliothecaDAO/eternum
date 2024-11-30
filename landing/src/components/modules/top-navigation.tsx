import { useConnect, useDisconnect } from "@starknet-react/core";

import { lordsAddress } from "@/config";
import { useDojo } from "@/hooks/context/DojoContext";
import { useLords } from "@/hooks/use-lords";
import { Uint256 } from "starknet";
import { TopNavigationView } from "./top-navigation-view";

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

  const handleMintTestLords = async () => {
    await mint_test_lords({ signer: account, lords_address: lordsAddress });
  };

  const handleConnect = (connector: any) => {
    connect({ connector });
  };

  return (
    <TopNavigationView
      lordsBalance={lordsBalance as Uint256}
      onMintTestLords={handleMintTestLords}
      connectors={connectors}
      onConnect={handleConnect}
      onDisconnect={disconnect}
      accountAddress={account?.address}
    />
  );
};
