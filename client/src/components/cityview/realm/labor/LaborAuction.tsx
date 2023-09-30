import { useLabor } from "../../../../hooks/helpers/useLabor";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { getPosition, getZone } from "../../../../utils/utils";

export const LaborAuction = () => {
  const realmId = useRealmStore((state) => state.realmId);

  const { useLaborAuctionCoefficient } = useLabor();

  const position = realmId ? getPosition(realmId) : undefined;
  const zone = position ? getZone(position.x) : undefined;

  const coefficient = zone ? useLaborAuctionCoefficient(zone) : undefined;

  return (
    <div className={"flex items-center text-white text-xxs space-x-4 mx-2"}>
      <div className="">Zone: </div>
      {zone && <div className="">{zone}</div>}
      <div className="">Labor Price: </div>
      {coefficient && <div className="">x {coefficient.toFixed(3)}</div>}
    </div>
  );
};
