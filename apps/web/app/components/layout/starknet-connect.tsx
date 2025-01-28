import { useStarknetkitConnectModal } from "starknetkit";
import { useConnect } from "@starknet-react/core";
import { Button } from "../ui/button";

export function StarknetConnect() {
    const { connect, connectors } = useConnect();
    const { starknetkitConnectModal } = useStarknetkitConnectModal({
      connectors: connectors
    })
    async function connectWallet() {
        const { connector } = await starknetkitConnectModal()
        if (!connector) {
          return
        }
       
        await connect({ connector })
      }
  return <Button className="rounded" onClick={connectWallet}>Connect</Button>;
}
