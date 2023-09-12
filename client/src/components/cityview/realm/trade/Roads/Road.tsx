import { useMemo } from "react";
import { OrderIcon } from "../../../../../elements/OrderIcon";
import Button from "../../../../../elements/Button";
import { orderNameDict } from "../../../../../constants/orders";
import * as realmsData from "../../../../../geodata/realms.json";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { getRealm } from "../../SettleRealmComponent";

type RoadProps = {
  toRealmId: number;
  usage: number;
  onAddUsage: () => void;
};

export const Road = (props: RoadProps) => {
  const { realmId } = useRealmStore();

  const fromRealm = useMemo(() => (realmId ? getRealm(realmId) : undefined), [realmId]);
  const toRealm = useMemo(() => (props.toRealmId ? getRealm(props.toRealmId) : undefined), [props.toRealmId]);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center justify-between">
        {fromRealm && (
          <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
            {/* // order of the order maker */}
            {fromRealm.order && <OrderIcon order={orderNameDict[fromRealm.order]} size="xs" className="mr-1" />}
            {realmsData["features"][fromRealm.realm_id - 1].name}
          </div>
        )}
        <div className="-mt-2 text-gold">Usages left: {props.usage}</div>
      </div>
      <div className="flex items-center text-gold pt-2">
        {toRealm && (
          <>
            Road to {toRealm.order && <OrderIcon order={orderNameDict[toRealm.order]} size="xs" className="mx-1" />}
            {realmsData["features"][toRealm.realm_id - 1].name}
          </>
        )}
        <div className="flex items-end ml-auto">
          <Button
            onClick={props.onAddUsage}
            variant={"danger"}
            className="ml-auto p-2 !h-4 text-xxs !rounded-md"
          >{`Add Usage`}</Button>
        </div>
      </div>
    </div>
  );
};
