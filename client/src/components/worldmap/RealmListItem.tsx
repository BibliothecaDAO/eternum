import { OrderIcon } from "../../elements/OrderIcon";
import Button from "../../elements/Button";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { findResourceById, orderNameDict } from "@bibliothecadao/eternum";
import { ReactComponent as Map } from "../../assets/icons/common/map.svg";
import * as realmsData from "../../geodata/realms.json";
import clsx from "clsx";
import useUIStore from "../../hooks/store/useUIStore";
import { displayAddress, numberToHex } from "../../utils/utils";
import { RealmExtended, useRealm } from "../../hooks/helpers/useRealm";

type RealmListItemProps = {
  realm: RealmExtended;
};

export const RealmListItem = ({ realm }: RealmListItemProps) => {
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);

  const { getRealmAddressName } = useRealm();

  const addressName = getRealmAddressName(realm.entity_id);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        {realm && (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {realm.order && <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mr-1" />}
            {realmsData["features"][realm.realm_id - 1].name}
          </div>
        )}
        <div className="-mt-2 ml-2 italic">
          owned by
          {!addressName && (
            <span className="text-gold ml-1 mr-1">{displayAddress(numberToHex(realm?.owner?.address || 0))}</span>
          )}
          {addressName && <span className="text-gold ml-1 mr-1">{addressName}</span>}
        </div>
        <div className=" text-gold flex ml-auto ">
          <Button
            onClick={() => moveCameraToRealm(realm?.realm_id as number)}
            variant="outline"
            className="p-1 !h-4 text-xxs !rounded-md"
          >
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div>
      </div>
      <div className="flex items-end mt-2">
        <div className={clsx("flex items-center justify-around flex-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            Resources:
            {realm.resources &&
              realm.resources.map((resourceId: number) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="xs" className="mb-1" />
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className="mt-2 space-x-2">
        <div className="text-gold inline-block">
          Cities: <span className="text-white">{realm.cities}</span>
        </div>
        <div className="text-gold inline-block">
          Harbors: <span className="text-white">{realm.harbors}</span>
        </div>
        <div className="text-gold inline-block">
          Rivers: <span className="text-white">{realm.rivers}</span>
        </div>
        <div className="text-gold inline-block">
          Regions: <span className="text-white">{realm.regions}</span>
        </div>
      </div>
    </div>
  );
};
