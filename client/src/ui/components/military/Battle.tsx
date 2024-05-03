import useUIStore from "@/hooks/store/useUIStore";
import { PositionArmyList } from "./ArmyList";
import { useDojo } from "@/hooks/context/DojoContext";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import { usePositionArmies } from "@/hooks/helpers/useArmies";
import { ArmyViewCard } from "./ArmyViewCard";
import { RealmViewCard } from "../structures/RealmViewCard";
import Button from "@/ui/elements/Button";

export const Battle = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
    },
  } = useDojo();

  const { formattedRealmsAtPosition } = useStructuresPosition({ position: { x, y } });
  const { allArmies, userArmies } = usePositionArmies({ position: { x, y } });

  console.log(userArmies);

  return (
    <div className="p-2">
      {/* <BattleStatusBar
        healthArmyOne={1000}
        healthArmyTwo={800}
        damagePerSecondArmyOne={50}
        damagePerSecondArmyTwo={30}
      /> */}
      {/* <h4>Your Armies</h4>
      <div className="grid grid-cols-3">
        {userArmies.map((entity, index) => (
          <ArmyViewCard key={index} army={entity} />
        ))}
      </div>
      <h4>All Armies</h4>
      <div className="grid grid-cols-3">
        {allArmies.map((entity, index) => (
          <ArmyViewCard key={index} army={entity} />
        ))}
      </div> */}
      {formattedRealmsAtPosition.length > 0 && (
        <div className="grid grid-cols-3">
          {formattedRealmsAtPosition.map((entity, index) => (
            <RealmViewCard
              onPillage={() =>
                provider.battle_start({ signer: account, attacking_army_id: 43n, defending_army_id: 95n })
              }
              onSiege={() => provider.battle_pillage({ signer: account, army_id: 43n, structure_id: entity.entity_id })}
              key={index}
              realm={entity}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const BattleStatusBar = ({
  healthArmyOne,
  healthArmyTwo,
  damagePerSecondArmyOne,
  damagePerSecondArmyTwo,
}: {
  healthArmyOne: number;
  healthArmyTwo: number;
  damagePerSecondArmyOne: number;
  damagePerSecondArmyTwo: number;
}) => {
  // Calculate the total health initially (could be set outside and passed as props if it changes)
  const totalHealth = healthArmyOne + healthArmyTwo;

  // Calculate the percentage of the bar each army occupies
  const armyOnePercentage = (healthArmyOne / totalHealth) * 100;
  const armyTwoPercentage = (healthArmyTwo / totalHealth) * 100;

  return (
    <>
      <div>
        <div className="flex justify-between my-3 mt-6">
          <div>
            {" "}
            <h4>Loaf</h4> Defending (-{damagePerSecondArmyOne} per tick)
          </div>
          <div>
            {" "}
            <h4>Click</h4> Attacking (-{damagePerSecondArmyTwo} per tick)
          </div>
        </div>
      </div>
      <div className="w-full flex h-8 border-2 border-gold">
        <div
          className="bg-blue-600/60 border-r-2 border-gold animate-pulse"
          style={{ width: `${armyOnePercentage}%` }}
        ></div>
        <div
          className="bg-red/60 border-l-2 border-gold animate-pulse"
          style={{ width: `${armyTwoPercentage}%` }}
        ></div>
      </div>
      <div className="flex justify-between">
        <div>{healthArmyOne} hp</div>
        <div>{healthArmyTwo} hp</div>
      </div>
    </>
  );
};
