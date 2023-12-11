import Button from "../../../elements/Button";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { ReactComponent as Bank } from "../../../assets/icons/common/bank.svg";
import { ReactComponent as DonkeyIcon } from "../../../assets/icons/units/donkey-circle.svg";
import { BankAuction } from "./BankAuction";
import { useBanks } from "../../../hooks/helpers/useBanks";
import { useCaravan } from "../../../hooks/helpers/useCaravans";
import { useMemo } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { Dot } from "../../../elements/Dot";
import { BankStaticInterface } from "@bibliothecadao/eternum";

type BanksListItemProps = {
  bank: BankStaticInterface;
  onFeed?: () => void;
};

export const BanksListItem = ({ bank, onFeed = undefined }: BanksListItemProps) => {
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const { useGetPositionCaravansIds } = useCaravan();

  const { useGetBank } = useBanks();
  const bankInfo = useGetBank(bank);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const caravanIds = bankInfo ? useGetPositionCaravansIds(bankInfo.position.x, bankInfo.position.y) : [];

  // summ the number of caravans that are mine versus others
  const myCaravans = useMemo(
    () =>
      caravanIds.reduce((acc, curr) => {
        if (curr.isMine) {
          return acc + 1;
        } else {
          return acc;
        }
      }, 0),
    [caravanIds],
  );

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          <Bank className="mr-1 text-gold" />
          <div className={"mt-1"}>{bank.name}</div>
        </div>

        {bankInfo && (
          <div className=" text-gold flex ml-auto ">
            <Button
              onClick={() => {
                moveCameraToTarget(bankInfo.uiPosition as any);
              }}
              variant="outline"
              className="p-1 !h-4 text-xxs !rounded-md"
            >
              <Map className="mr-1 fill-current" />
              Show on map
            </Button>
          </div>
        )}
      </div>
      {bankInfo && (
        <div className="mr-2 m-1">
          <BankAuction bankInfo={bankInfo} resourceId={254} />
          <BankAuction bankInfo={bankInfo} resourceId={255} />
        </div>
      )}
      {bankInfo && (
        <div className="flex flex-row w-full justify-between">
          {bankInfo.distance && (
            <div className={"mt-3 mr-2 text-gold text-xxs"}>{`${bankInfo.distance.toFixed(2)} kms away`}</div>
          )}
          <div
            onMouseEnter={() =>
              setTooltip({
                position: "top",
                content: (
                  <>
                    <p className="whitespace-nowrap">{`You have ${myCaravans} caravans arrived or headed for this bank`}</p>
                    <p className="whitespace-nowrap">{`Other realms have ${
                      caravanIds.length - myCaravans
                    } caravans arrived or headed for this bank`}</p>
                  </>
                ),
              })
            }
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="flex items-center justify-between mt-[6px] text-xxs"
          >
            <DonkeyIcon />
            <div className="flex items-center ml-2 space-x-[6px]">
              <div className="flex flex-col items-center">
                <Dot colorClass="bg-green" />
                <div className="mt-1 text-green">{myCaravans}</div>
              </div>
              <div className="flex flex-col items-center ml-2">
                <Dot colorClass="bg-orange" />
                <div className="mt-1 text-orange">{caravanIds.length - myCaravans}</div>
              </div>
            </div>
          </div>
          {/* <div className={"mt-3 mr-2 text-gold text-xxs"}>{`Total Caravans: ${caravanIds.length - myCaravans}`}</div> */}
          <div className="flex items-center mt-2">
            {onFeed && (
              <Button
                // disabled={hyperstructure?.completed}
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                variant="outline"
                onClick={onFeed}
              >
                Send Food
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
