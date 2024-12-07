import { useState } from "react";
import { useRealm } from "./useRealm";

import { useDojo } from "../context/DojoContext";
import { soundSelector, useUiSounds } from "../useUISound";

export const useSettleRealm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);
  const [tokenId, setTokenId] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { getRandomUnsettledRealmId } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const {
    setup: {
      systemCalls: { create_multiple_realms_dev },
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
      const calldata = [Number(id)];

      await create_multiple_realms_dev({
        signer: account,
        realm_ids: [...calldata],
      });

      playSign();
      return id;
    } catch (error) {
      console.error("Error during minting:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { settleRealm, isLoading, selectedOrder, setSelectedOrder, tokenId, setTokenId, errorMessage };
};
