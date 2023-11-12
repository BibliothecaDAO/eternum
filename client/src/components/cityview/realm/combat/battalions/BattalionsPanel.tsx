import { useMemo, useState } from "react";
import Button from "../../../../../elements/Button";
import { Battalion } from "./Battalion";
import { useCombat } from "../../../../../hooks/helpers/useCombat";
import { CreateBattalionPopup } from "./CreateBattalionPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";

type BattalionsPanelProps = {};

export const BattalionsPanel = ({}: BattalionsPanelProps) => {
  const [showBuildBattalion, setShowBuildBattalion] = useState(false);
  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { useRealmBattalions, getEntitiesCombatInfo } = useCombat();
  const entities = useRealmBattalions(realmEntityId);

  const battalions = useMemo(() => {
    const tmp = getEntitiesCombatInfo(entities);
    const sum = tmp.reduce(
      (acc, battalion) => {
        acc.health += battalion.health;
        acc.quantity += battalion.quantity;
        acc.attack += battalion.attack;
        acc.defence += battalion.defence;
        acc.sec_per_km += battalion.sec_per_km;
        acc.capacity += battalion.capacity;
        return acc;
      },
      {
        health: 0,
        quantity: 0,
        attack: 0,
        defence: 0,
        sec_per_km: 0,
        capacity: 0,
      },
    );
    return sum;
  }, [entities]);

  return (
    <div className="relative flex flex-col pb-3">
      {showBuildBattalion && <CreateBattalionPopup onClose={() => setShowBuildBattalion(false)} />}
      <div className="flex flex-col p-2 space-y-2">
        <Battalion
          onBuild={() => setShowBuildBattalion(true)}
          battalion={{
            entityId: undefined,
            health: battalions.health,
            quantity: battalions.quantity,
            attack: battalions.attack,
            defence: battalions.defence,
            sec_per_km: battalions.sec_per_km,
            blocked: false,
            capacity: battalions.capacity,
          }}
        />
      </div>

      <div className="sticky w-32 -translate-x-1/2 bottom-2 left-1/2 !rounded-full flex flex-col items-center mt-4 mb-1">
        <Button className="" onClick={() => setShowBuildBattalion(true)} variant="primary">
          {battalions.quantity === 0 ? "+ Create new battalion" : "Add more units"}
        </Button>
      </div>
    </div>
  );
};
