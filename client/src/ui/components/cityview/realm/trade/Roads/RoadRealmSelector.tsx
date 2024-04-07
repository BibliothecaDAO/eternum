import { useEffect, useState } from "react";
import useRealmStore from "../../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../../hooks/context/DojoContext";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import { SelectableRealmInterface, getOrderName } from "@bibliothecadao/eternum";
import { useGetRoads, useRoads } from "../../../../../../hooks/helpers/useRoads";
import { useRealm } from "../../../../../../hooks/helpers/useRealm";
import { useCaravan } from "../../../../../../hooks/helpers/useCaravans";
import { getRealm } from "../../../../../utils/realms";
import { RealmList } from "../../RealmList";

export const RoadRealmSelector = ({
  selectedRealmEntityId,
  setSelectedRealmEntityId,
}: {
  selectedRealmEntityId: bigint | undefined;
  setSelectedRealmEntityId: (selectRealmEntityId: bigint) => void;
}) => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const { getRealmEntityIdFromRealmId, getRealmAddressName } = useRealm();

  const [selectableRealms, setSelectableRealms] = useState<SelectableRealmInterface[]>([]);

  const realmId = useRealmStore((state) => state.realmId);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { calculateDistance } = useCaravan();

  const { getHasRoad } = useRoads();

  const { roads } = useGetRoads(realmEntityId);

  useEffect(() => {
    const buildSelectableRealms = () => {
      let entityIds = runQuery([Has(Realm)]);
      let realms = Array.from(entityIds)
        .map((entityId) => {
          const realm = getComponentValue(Realm, entityId);
          const hasRoad = getHasRoad(realmEntityId, realm?.entity_id);
          if (realm && !hasRoad) {
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
  }, [roads]);

  return (
    <RealmList
      selectableRealms={selectableRealms}
      selectedRealmEntityId={selectedRealmEntityId}
      setSelectedRealmEntityId={setSelectedRealmEntityId}
      title="Create New Road"
    />
  );
};
