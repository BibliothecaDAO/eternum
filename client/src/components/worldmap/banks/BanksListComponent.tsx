import { useState } from "react";
import { BanksListItem } from "./BanksListItem";
import { BankPopup } from "./BankPopup";
import { BankInterface, useBanks } from "../../../hooks/helpers/useBanks";

type BanksListComponentProps = {
  showOnlyPlayerOrder?: boolean;
};

export const BanksListComponent = ({ showOnlyPlayerOrder = false }: BanksListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  // const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const [selectedBank, setSelectedBank] = useState<BankInterface>(null);
  const { getBanks } = useBanks();

  const banks = getBanks();

  return (
    <>
      {showFeedPopup && <BankPopup bank={selectedBank} onClose={() => setShowFeedPopup(false)} />}
      {banks && (
        <div className="flex flex-col space-y-2 px-2 mt-2">
          <div className="text-xs text-gold">Other Banks: </div>
          {banks.map((bank, i) => (
            <BanksListItem
              key={i}
              bank={bank}
              onFeed={() => {
                // moveCameraToTarget([0, 0, 0] as any);
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
