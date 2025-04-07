import { useCallback } from "react";
import { useDojo } from "../";

export const useBridgeAsset = () => {
  const {
    account: { account },
    setup: {
      systemCalls: { bridge_deposit_into_realm, bridge_withdraw_from_realm},
    },
  } = useDojo();


  const _bridgeIntoRealm = useCallback(
    async (
      resources: { tokenAddress: string; amount: bigint }[],
      recipientStructureId: bigint,
      clientFeeRecipient: bigint
    ) => {
      if (account) {
        return await bridge_deposit_into_realm({
          signer: account,
          resources: resources,
          recipient_structure_id: recipientStructureId,
          client_fee_recipient: clientFeeRecipient
        })
          .then((resp) => {
            return resp;
          })
          .catch((e) => {
            console.error(`Bridge into realm error:`, e);
          });
      }
    },
    [account, bridge_deposit_into_realm],
  );

  const _bridgeWithdrawFromRealm = useCallback(
    async (resources: { tokenAddress: string; amount: bigint }[], fromStructureId: bigint, toRecipientAddress: bigint, clientFeeRecipient: bigint) => {
      if (account) {
        return await bridge_withdraw_from_realm({
          signer: account,
          resources: resources,
          from_structure_id: fromStructureId,
          recipient_address: toRecipientAddress,
          client_fee_recipient: clientFeeRecipient
        })
          .then((resp) => {
            return resp;
          })
          .catch((e) => {
            console.error(`Bridge withdraw from realm error:`, e);
          });
      }
    },
    [account, bridge_withdraw_from_realm],
  );

  return {
    bridgeDepositIntoRealm: _bridgeIntoRealm,
    bridgeWithdrawFromRealm: _bridgeWithdrawFromRealm,
  };
};
