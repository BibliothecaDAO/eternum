import { useState } from "react";
import { useRealm } from "./useRealm";

import { useDojo } from "../context/DojoContext";
import { soundSelector, useUiSounds } from "../useUISound";

export const useSettleRealm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [tokenId, setTokenId] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { getNextRealmIdForOrder, getRealmIdForOrderAfter, getRandomUnsettledRealmId } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const {
    setup: {
      systemCalls: { create_multiple_realms },
    },
    account: { account },
  } = useDojo();

  const settleRealm = async (id?: number) => {
    if (!id) {
      id = getRandomUnsettledRealmId();
    }

    try {
      setIsLoading(true);
      setErrorMessage(null); // Reset error message before attempting to settle
      const calldata = [];

      calldata.push(Number(id));

      console.log(calldata);

      await create_multiple_realms({
        signer: account,
        realm_ids: [...calldata],
      });

      playSign();
    } catch (error) {
      setErrorMessage("Realm already settled. Please try a different Realm.");
      console.error("Error during minting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { settleRealm, isLoading, selectedOrder, setSelectedOrder, tokenId, setTokenId, errorMessage };
};
