import { useState } from "react";
import Button from "../../../elements/Button";

import realmCoords from "../../../geodata/coords.json";
import { useDojo } from "../../../DojoContext";

import { getLatestRealmId } from "../../../hooks/graphql/useGraphQLQueries";
import { soundSelector, useUiSounds } from "../../../hooks/useUISound";
import { getRealm } from "../../../utils/realms";
import useRealmStore from "../../../hooks/store/useRealmStore";

export const MAX_REALMS = 5;

export const SettleRealmComponent = () => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    setup: {
      systemCalls: { create_realm, mint_resources },
    },
    account: { account, masterAccount },
  } = useDojo();

  const { play: playSign } = useUiSounds(soundSelector.sign);

  const { realmEntityIds } = useRealmStore();

  const canSettle = realmEntityIds.length < MAX_REALMS;

  const settleRealm = async () => {
    setIsLoading(true);
    // if no realm id latest realm id is 0
    const realm_id = await getLatestRealmId();

    // take next realm id
    let new_realm_id = realm_id + 1;
    let realm = getRealm(new_realm_id);
    let position = getPosition(new_realm_id);
    let entity_id = await create_realm({
      signer: masterAccount,
      owner: BigInt(account.address),
      ...realm,
      position,
    });
    // mint basic resources to start
    await mint_resources({
      signer: masterAccount,
      entity_id,
      resource_type: 2,
      amount: 1000,
    });
    await mint_resources({
      signer: masterAccount,
      entity_id,
      resource_type: 3,
      amount: 1000,
    });
    await mint_resources({
      signer: masterAccount,
      entity_id,
      resource_type: 253,
      amount: 1000,
    });
    setIsLoading(false);
    playSign();
  };

  return (
    <div className="flex items-center h-min">
      {!isLoading && (
        <Button
          disabled={!canSettle}
          onClick={settleRealm}
          className="ml-auto p-2 !h-8 text-lg !rounded-md"
          variant="success"
        >
          Settle Realm
        </Button>
      )}
      {isLoading && (
        <Button isLoading={true} onClick={() => {}} variant="danger" className="ml-2 p-2 !h-4 text-xxs !rounded-md">
          {}
        </Button>
      )}
    </div>
  );
};

export function getPosition(realm_id: number): { x: number; y: number } {
  const coords = realmCoords.features[realm_id - 1].geometry.coordinates.map((value) => parseInt(value));
  return { x: coords[0] + 1800000, y: coords[1] + 1800000 };
}

export default SettleRealmComponent;
