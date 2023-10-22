import { useMemo, useState } from "react";
import Button from "../../../elements/Button";

import { useDojo } from "../../../DojoContext";
import { getOrderName, orders } from "../../../constants/orders";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { getRealm } from "../../../utils/realms";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { OrderIcon } from "../../../elements/OrderIcon";
import { useRealm } from "../../../hooks/helpers/useRealm";
import clsx from "clsx";
import { getPosition, multiplyByPrecision } from "../../../utils/utils";
import { initialResources } from "../../../constants/resources";
import { BigNumberish } from "starknet";

export const MAX_REALMS = 5;

export const MintCryptsAndCavernsComponent = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(1);

  const {
    setup: {
      systemCalls: { mint_cc },
    },
    account: { account, masterAccount },
  } = useDojo();

  const { getNextRealmIdForOrder } = useRealm();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );
  const canSettle = realmEntityIds.length < MAX_REALMS;

  const mintCC = async () => {

    await mint_cc({
      signer: account
    });
    setIsLoading(false);
  };

  return (
    <>
      <div className="flex flex-col h-min">
        <div className="text-xxs mb-2 italic text-gold">
          {`Mint belongs to your Crypts and Caverns`}
        </div>
        <Button
          disabled={!canSettle}
          isLoading={isLoading}
          onClick={() => (!isLoading ? mintCC() : null)}
          className="mr-auto !h-6 mt-2 text-xxs !rounded-md !p-2"
          variant={!isLoading ? "success" : "danger"}
        >
          {!isLoading ? "Mint Crypts and Caverns " : ""}
        </Button>
      </div>
    </>
  );
};

export default MintCryptsAndCavernsComponent;
