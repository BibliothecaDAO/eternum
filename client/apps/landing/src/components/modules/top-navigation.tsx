import { useAccount, useConnect, useDisconnect, useSendTransaction } from "@starknet-react/core";

import { lordsAddress } from "@/config";
import { useLords } from "@/hooks/use-lords";
import { TopNavigationView } from "./top-navigation-view";

export const TopNavigation = () => {
  const { account } = useAccount();

  const { address } = useAccount();

  const { send, error } = useSendTransaction({
    calls: [
      {
        contractAddress: lordsAddress,
        entrypoint: "mint_test_lords",
        calldata: [],
      },
    ],
  });

  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { lordsBalance } = useLords();

  const handleMintTestLords = async () => {
    if (!address) return;
    send();
  };

  const handleConnect = (connector: any) => {
    connect({ connector });
  };

  return (
    <TopNavigationView
      lordsBalance={lordsBalance}
      onMintTestLords={handleMintTestLords}
      connectors={connectors}
      onConnect={handleConnect}
      onDisconnect={disconnect}
      accountAddress={account?.address}
    />
  );
};
