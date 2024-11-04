import { useState } from "react";
import { useRealm } from "./useRealm";

import { MAX_REALMS } from "@/ui/constants";
import { getRealm } from "@/ui/utils/realms";
import { useDojo } from "../context/DojoContext";
import { soundSelector, useUiSounds } from "../useUISound";

export const useSettleRealm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [tokenId, setTokenId] = useState<number>(0);

  const { getNextRealmIdForOrder, getRealmIdForOrderAfter } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const {
    setup: {
      systemCalls: { create_multiple_realms },
    },
    account: { account },
  } = useDojo();

  const settleRealm = async () => {
    try {
      setIsLoading(true);
      const calldata = [];
      let newRealmId = getNextRealmIdForOrder(selectedOrder);

      for (let i = 0; i < MAX_REALMS; i++) {
        if (i > 0) {
          newRealmId = getRealmIdForOrderAfter(selectedOrder, newRealmId);
        }
        const realm = getRealm(newRealmId);
        if (!realm) return;
        calldata.push(Number(realm.realmId));
      }

      console.log(calldata);

      await create_multiple_realms({
        signer: account,
        realm_ids: [...calldata],
      });

      playSign();
    } finally {
      setIsLoading(false);
    }
  };

  return { settleRealm, isLoading, selectedOrder, setSelectedOrder, tokenId, setTokenId };
};
