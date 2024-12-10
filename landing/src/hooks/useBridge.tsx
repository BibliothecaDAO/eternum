import { realmsAddress } from "@/config";
import { useAccount } from "@starknet-react/core";
import { useCallback } from "react";
import { toast } from "sonner";
import { env } from "../../env";
import { useDojo } from "./context/DojoContext";

export const useBridgeAsset = () => {
  // todo; use starknet-react
  const {
    setup: {
      systemCalls: { bridge_resources_into_realm, bridge_start_withdraw_from_realm, bridge_finish_withdraw_from_realm },
    },
  } = useDojo();

  const { account } = useAccount();

  const _bridgeIntoRealm = useCallback(
    async (
      resources: { tokenAddress: string; amount: bigint }[],
      throughBankId: bigint,
      recipientRealmEntityId: bigint,
    ) => {
      if (account) {
       return await bridge_resources_into_realm({
          signer: account,
          resources: resources,
          through_bank_id: throughBankId,
          recipient_realm_entity_id: recipientRealmEntityId,
          client_fee_recipient: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        })
          .then((resp) => {
            toast(`Transfer initiated successfully`);
            return resp;
          })
          .catch((e) => {
            console.error(`Bridge into realm error:`, e);
          });
      }
    },
    [account, bridge_resources_into_realm],
  );

  const _bridgeStartWithdrawFromRealm = useCallback(
    async (resources: { tokenAddress: string; amount: bigint }[], throughBankId: bigint, fromRealmEntityId: bigint) => {
      if (account) {
        await bridge_start_withdraw_from_realm({
          signer: account,
          resources: resources,
          through_bank_id: throughBankId,
          from_realm_entity_id: fromRealmEntityId,
        })
          .then(() => {
            toast(`Withdrawal initiated successfully. Resources are on their way to the bank.`);
          })
          .catch((e) => {
            console.error(`Bridge withdraw from realm error:`, e);
          });
      }
    },
    [account, bridge_start_withdraw_from_realm, realmsAddress],
  );

  const _bridgeFinishWithdrawFromRealm = useCallback(
    async (tokenAddress: string, throughBankId: bigint, fromDonkeyEntityId: bigint) => {
      if (account) {
        await bridge_finish_withdraw_from_realm({
          signer: account,
          tokenAddress: tokenAddress,
          through_bank_id: throughBankId,
          from_entity_id: fromDonkeyEntityId,
          recipient_address: account.address,
          client_fee_recipient: env.VITE_PUBLIC_CLIENT_FEE_RECIPIENT,
        })
          .then(() => {
            toast(`Withdrawal Completed! Resources sent to your wallet!`);
          })
          .catch((e) => {
            console.error(`Bridge withdraw from realm error:`, e);
          });
      }
    },
    [account, bridge_finish_withdraw_from_realm, realmsAddress],
  );

  return {
    bridgeIntoRealm: _bridgeIntoRealm,
    bridgeStartWithdrawFromRealm: _bridgeStartWithdrawFromRealm,
    bridgeFinishWithdrawFromRealm: _bridgeFinishWithdrawFromRealm,
  };
};
