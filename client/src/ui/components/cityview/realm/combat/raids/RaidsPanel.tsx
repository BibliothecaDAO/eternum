import { useMemo, useState } from "react";
import Button from "../../../../../elements/Button";
import { Raid } from "./Raid";
import { useCombat } from "../../../../../../hooks/helpers/useCombat";
import { CreateRaidersPopup } from "./CreateRaidersPopup";
import { ManageSoldiersPopupTabs } from "./ManageSoldiersPopupTabs";
import { AttackRaidsPopup } from "./AttackRaidsPopup";
import { TravelRaidsPopup } from "./TravelRaidsPopup";
import { HealPopup } from "../HealPopup";
import { CombatInfo } from "@bibliothecadao/eternum";
import clsx from "clsx";

type RaidsPanelProps = {
  raiderIds: bigint[];
  showCreateButton: boolean;
  className?: string;
};

export const RaidsPanel = ({ raiderIds, showCreateButton, className }: RaidsPanelProps) => {
  const [showBuildRaiders, setShowBuildRaiders] = useState(false);
  const [selectedRaider, setSelectedRaider] = useState<CombatInfo | null>(null);

  const [showTravelRaid, setShowTravelRaid] = useState(false);
  const [showAttackRaid, setShowAttackRaid] = useState(false);
  const [showManageRaid, setShowManageRaid] = useState(false);
  const [showHealRaid, setShowHealRaid] = useState(false);

  const { getEntitiesCombatInfo } = useCombat();

  const raiders = useMemo(() => {
    return getEntitiesCombatInfo(raiderIds);
  }, [raiderIds]);

  const onClose = () => {
    setShowBuildRaiders(false);
    setShowTravelRaid(false);
    setShowAttackRaid(false);
    setShowManageRaid(false);
    setShowHealRaid(false);
    setSelectedRaider(null);
  };

  return (
    <div className={clsx("relative flex flex-col", className)}>
      {/* // TODO: need to filter on only trades that are relevant (status, not expired, etc) */}
      {showBuildRaiders && <CreateRaidersPopup onClose={onClose} />}
      {selectedRaider && showManageRaid && (
        <ManageSoldiersPopupTabs headline={"Manage Raiders"} selectedRaider={selectedRaider} onClose={onClose} />
      )}
      {selectedRaider?.position !== undefined && selectedRaider?.locationEntityId !== undefined && showAttackRaid && (
        <AttackRaidsPopup
          attackPosition={selectedRaider.position}
          targetEntityId={selectedRaider.locationEntityId}
          onClose={onClose}
        />
      )}
      {selectedRaider && showTravelRaid && <TravelRaidsPopup selectedRaider={selectedRaider} onClose={onClose} />}
      {selectedRaider && showHealRaid && <HealPopup selectedRaider={selectedRaider} onClose={onClose} />}
      <div className="flex flex-col p-2 space-y-2">
        {raiders.map((raider) => (
          <Raid
            key={raider.entityId}
            raider={raider}
            isSelected={selectedRaider?.entityId === raider.entityId}
            setShowTravelRaid={() => {
              setShowTravelRaid(true);
              setSelectedRaider(raider);
            }}
            setShowHealRaid={() => {
              setShowHealRaid(true);
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
      {showCreateButton && (
        <div className="sticky w-32 -translate-x-1/2 top-10 bottom-2 left-1/2 !rounded-full flex flex-col items-center">
          <Button className="" onClick={() => setShowBuildRaiders(true)} variant="primary">
            + New raiding party
          </Button>
        </div>
      )}
    </div>
  );
};
