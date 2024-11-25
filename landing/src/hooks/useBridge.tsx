import { realmsAddress } from "@/config";
import { useCallback } from "react";
import { toast } from "sonner";
import { env } from "../../env";
import { useDojo } from "./context/DojoContext";

export const useBridgeAsset = () => {
  const {
    setup: {
      systemCalls: { bridge_resource_into_realm },
    },
    account: { account },
  } = useDojo();

  // const [isMinting, setIsMinting] = useState(false);
  // const [mintingTokenId, setMintingTokenId] = useState(0);


  const _bridgeIntoRealm = useCallback(
    async (
      tokenAddress: string, 
      throughBankId: bigint, 
      recipientRealmEntityId: bigint, 
      amount: bigint
    ) => {
      if (account) {
        await bridge_resource_into_realm({ 
          signer: account, 
          token: tokenAddress, 
          through_bank_id: throughBankId, 
          recipient_realm_entity_id: recipientRealmEntityId, 
          amount, 
          client_fee_recipient: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT 
        })
          .then(() => {
            toast(`Transfer initiated successfully`);
          })
          .catch((e) => {
            console.error(`Bridge into realm error:`, e);
          });
      }
    },
    [account, bridge_resource_into_realm, realmsAddress],
  );

  // useEffect(() => {
  //   if (isMinting) {
  //     setIsMinting(false);
  //   }
  // }, [mintingTokenId]);

  return {
    bridgeIntoRealm: _bridgeIntoRealm,
  };
};
