import { useMemo, useState } from "react";
import Button from "../../../../../elements/Button";
import { Raid } from "./Raid";
import { CombatInfo, useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateRaidsPopup } from "./CreateRaidsPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { ManageRaidsPopup } from "./ManageRaidsPopup";
import { AttackRaidsPopup } from "./AttackRaidsPopup";
import { TravelRaidsPopup } from "./TravelRaidsPopup";

type RaidsPanelProps = {};

export const RaidsPanel = ({}: RaidsPanelProps) => {
  const [showBuildRaiders, setShowBuildRaiders] = useState(false);
  const [selectedRaider, setSelectedRaider] = useState<CombatInfo>(null);

  const [showTravelRaid, setShowTravelRaid] = useState(false);
  const [showAttackRaid, setShowAttackRaid] = useState(false);
  const [showManageRaid, setShowManageRaid] = useState(false);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { useRealmRaiders, getEntitiesCombatInfo } = useCombat();
  const entities = useRealmRaiders(realmEntityId);

  const raiders = useMemo(() => {
    return getEntitiesCombatInfo(entities);
  }, [entities]);

  return (
    <div className="relative flex flex-col pb-3 min-h-[120px]">
      {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
      {showBuildRaiders && <CreateRaidsPopup onClose={() => setShowBuildRaiders(false)} />}
      {showManageRaid && <ManageRaidsPopup selectedRaiders={selectedRaider} onClose={() => setShowManageRaid(false)} />}
      {showAttackRaid && <AttackRaidsPopup selectedRaider={selectedRaider} onClose={() => setShowAttackRaid(false)} />}
      {showTravelRaid && <TravelRaidsPopup selectedRaiders={selectedRaider} onClose={() => setShowTravelRaid(false)} />}

      <div className="flex flex-col p-2 space-y-2">
        {raiders.map((raider) => (
          <Raid
            key={raider.entityId}
            raider={raider}
            setShowTravelRaid={() => {
              setShowTravelRaid(true);
              setSelectedRaider(raider);
            }}
            setShowAttackRaid={() => {
              setShowAttackRaid(true);
              setSelectedRaider(raider);
            }}
            setShowManageRaid={() => {
              setShowManageRaid(true);
              setSelectedRaider(raider);
            }}
          />
        ))}
      </div>

      <div className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full flex flex-col items-center">
        <Button className="" onClick={() => setShowBuildRaiders(true)} variant="primary">
          + New raiding party
        </Button>
      </div>
    </div>
  );
};
