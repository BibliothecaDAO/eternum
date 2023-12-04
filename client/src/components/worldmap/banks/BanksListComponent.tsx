import { useState } from "react";
import { BanksListItem } from "./BanksListItem";
import { BankPopup } from "./BankPopup";
import { BankStaticInterface, targetPrices, useBanks } from "../../../hooks/helpers/useBanks";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import useUIStore from "../../../hooks/store/useUIStore";

type BanksListComponentProps = {};

export const BanksListComponent = ({}: BanksListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedBank, setSelectedBank] = useState<BankStaticInterface>(null);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const { getBanksStatic } = useBanks();
  const banks = getBanksStatic();

  return (
    <>
      {showFeedPopup && <BankPopup bank={selectedBank} onClose={() => setShowFeedPopup(false)} />}
      <div
        onMouseEnter={() =>
          setTooltip({
            position: "bottom",
            content: (
              <>
                <p className="whitespace-nowrap">Target Prices for Wheat and Fish when normal demand</p>
              </>
            ),
          })
        }
        onMouseLeave={() => {
          setTooltip(null);
        }}
        className="flex flex-row justify-center px-3 w-full mt-4 text-white text-xs mb-2"
      >
        <div className="flex flex-row items-center mr-4">
          <div className="">1</div>
          <ResourceIcon resource={"Wheat"} size="xs" />
          <div className="whitespace-nowrap"> {`= ${1 / targetPrices[254]}`}</div>
          <ResourceIcon resource={"Shekels" || ""} size="xs" />
        </div>
        <div className="flex flex-row items-center">
          <div className="">1</div>
          <ResourceIcon resource={"Fish"} size="xs" />
          <div className="whitespace-nowrap"> {`= ${1 / targetPrices[255]}`}</div>
          <ResourceIcon resource={"Shekels" || ""} size="xs" />
        </div>
      </div>
      {banks && (
        <div className="flex flex-col space-y-2 px-2 mt-4">
          {banks.map((bank, i) => (
            <BanksListItem
              key={i}
              bank={bank}
              onFeed={() => {
                setShowFeedPopup(true);
                setSelectedBank(bank);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
