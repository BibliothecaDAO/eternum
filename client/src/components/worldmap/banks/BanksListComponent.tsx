import useRealmStore from "../../../hooks/store/useRealmStore";
import { useMemo, useState } from "react";
import { getRealm } from "../../../utils/realms";
import { useDojo } from "../../../DojoContext";
import banks from "../../../data/banks.json";
import { BanksListItem } from "./BanksListItem";
import { BankPopup } from "./BankPopup";

type BanksListComponentProps = {
  showOnlyPlayerOrder?: boolean;
};

export const BanksListComponent = ({ showOnlyPlayerOrder = false }: BanksListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  // const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const [selectedBank, setSelectedBank] = useState(null);

  const {
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );

  return (
    <>
      {chosenOrder && showFeedPopup && <BankPopup bank={selectedBank} onClose={() => setShowFeedPopup(false)} />}
      {banks && (
        <div className="flex flex-col space-y-2 px-2 mt-2">
          <div className="text-xs text-gold">Other Banks: </div>
          {banks.map((bank, i) =>
            chosenOrder && i + 1 === chosenOrder ? null : (
              <BanksListItem
                key={i}
                bank={bank}
                onFeed={() => {
                  // moveCameraToTarget([0, 0, 0] as any);
                  setShowFeedPopup(true);
                  setSelectedBank(bank);
                }}
              />
            ),
          )}
        </div>
      )}
    </>
  );
};
