import { OrderIcon } from "../../../elements/OrderIcon";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import { findResourceById, orderNameDict } from "@bibliothecadao/eternum";
import clsx from "clsx";
import useUIStore from "../../../../hooks/store/useUIStore";
import { RealmExtended, useRealm } from "../../../../hooks/helpers/useRealm";
import { InventoryResources } from "../../resources/InventoryResources";

type RealmListItemProps = {
  realm: RealmExtended;
  onClick?: () => void;
};

export const RealmListItem = ({ realm, onClick }: RealmListItemProps) => {
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);

  const { getRealmAddressName } = useRealm();

  const addressName = getRealmAddressName(BigInt(realm.entity_id));

  return (
    <div className="flex flex-col p-2 border  ">
      <div className="flex items-center">
        {realm && (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0  border-gold">
            {realm.order && <OrderIcon order={orderNameDict[realm.order]} size="xs" className="mr-1" />}
            {realm.name}
          </div>
        )}
        <div className="-mt-2 ml-2 italic text-xs">
          {addressName && <span className="text-gold ml-1 mr-1">{addressName}</span>}
        </div>
        {/* <div className=" text-gold flex ml-auto ">
          <Button
            onClick={() => moveCameraToRealm(Number(realm?.realmId))}
            variant="outline"
            className="p-1 !h-4 text-xxs !rounded-md"
          >
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div> */}
      </div>
      <div className="flex items-end mt-2">
        <div className={clsx("flex items-center justify-around flex-1")}>
          <div className="flex-1 text-gold flex items-center flex-wrap">
            Produces:
            {realm.resources &&
              realm.resources.map((resourceId: number) => (
                <div className="flex flex-col items-center mx-2 my-0.5" key={resourceId}>
                  <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size="md" className="mb-1" />
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2">
        <div className="text-gold border p-1">
          Cities: <span className="">{realm.cities}</span>
        </div>
        <div className="text-gold border  p-1">
          Harbors: <span className="">{realm.harbors}</span>
        </div>
        <div className="text-gold  border p-1">
          Rivers: <span className="">{realm.rivers}</span>
        </div>
        <div className="text-gold  border p-1">
          Regions: <span className="">{realm.regions}</span>
        </div>
      </div>
      <InventoryResources entityId={BigInt(realm.entity_id)} />
    </div>
  );
};
