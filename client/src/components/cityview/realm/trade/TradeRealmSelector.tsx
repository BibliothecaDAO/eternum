import { useEffect, useState } from "react";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../DojoContext";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import { RealmList } from "../RealmList";
import { SelectableRealmInterface, getOrderName } from "@bibliothecadao/eternum";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { useTrade } from "../../../../hooks/helpers/useTrade";
import { useCaravan } from "../../../../hooks/helpers/useCaravans";
import { getRealm } from "../../../../utils/realms";

export const TradeRealmSelector = ({
  selectedRealmId,
  setSelectedRealmId,
}: {
  selectedRealmId: bigint | undefined;
  setSelectedRealmId: (selectedRealmId: bigint) => void;
}) => {
  const [selectableRealms, setSelectableRealms] = useState<SelectableRealmInterface[]>([]);

  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const { getRealmAddressName } = useRealm();

  const { realmId, realmEntityId } = useRealmStore();

  const { getRealmEntityIdFromRealmId } = useTrade();

  const { calculateDistance } = useCaravan();

  useEffect(() => {
    const buildSelectableRealms = () => {
      let entityIds = runQuery([Has(Realm)]);
      let realms = Array.from(entityIds)
        .map((entityId) => {
          const realm = getComponentValue(Realm, entityId);
          if (realm) {
            const realmData = getRealm(realm.realm_id);
            if (!realmData) return undefined;
            const { name, order, realmId: takerRealmId } = realmData;
            const takerEntityId = getRealmEntityIdFromRealmId(takerRealmId);
            const distance = takerEntityId ? calculateDistance(realmEntityId, takerEntityId) ?? 0 : 0;
            const addressName = takerEntityId ? getRealmAddressName(takerEntityId) : "";
            return {
              entityId: realm.entity_id,
              realmId: realm.realm_id,
              name,
              order: getOrderName(order),
              distance,
              addressName,
            };
          }
        })
        .filter((realm) => realm && realm.realmId !== realmId) as SelectableRealmInterface[];
      setSelectableRealms(realms);
    };
    buildSelectableRealms();
  }, []);

  return (
    <RealmList
      selectableRealms={selectableRealms}
      selectedRealmId={selectedRealmId}
      setSelectedRealmId={setSelectedRealmId}
    />
  );
};
