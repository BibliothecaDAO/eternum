import { useDojo } from "../../DojoContext";
import useRealmStore from "../store/useRealmStore";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";

export function useBuildings() {
  const {
    setup: {
      components: { LaborBuilding },
    },
  } = useDojo();

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const getLaborBuilding = () => {
    let building = getComponentValue(LaborBuilding, getEntityIdFromKeys([realmEntityId]));
    if (building && Number(building.building_type) !== 0) {
      return building;
    }
  };

  return { getLaborBuilding };
}
