import useUIStore from "@/hooks/store/useUIStore";
import { PositionArmyList } from "./ArmyList";
import { useDojo } from "@/hooks/context/DojoContext";
import { useStructuresPosition } from "@/hooks/helpers/useStructures";
import { ArmyAndName, usePositionArmies } from "@/hooks/helpers/useArmies";
import { ArmyViewCard } from "./ArmyViewCard";
import { RealmViewCard } from "../structures/RealmViewCard";
import Button from "@/ui/elements/Button";
import { useMemo, useState } from "react";
import { RealmListItem } from "../worldmap/realms/RealmListItem";
import { Headline } from "@/ui/elements/Headline";
import { useModal } from "@/hooks/store/useModal";

export const ArmiesAtLocation = () => {
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

  const { toggleModal } = useModal();

  return (
    <div>
      {/* {userArmies.length !== 0 && (
        <div className="my-3">
          <Headline className="my-3">Armies</Headline>
          <div className="grid grid-cols-3 gap-4">
            {userArmies.map((entity, index) => (
              <ArmyViewCard
                // active={entity.entity_id.toString() == selectedArmy}
                onClick={(value) => console.log(value)}
                key={index}
                army={entity}
              />
            ))}
          </div>
        </div>
      )} */}
      {allArmies.length !== 0 && (
        <>
          <Headline className="my-3">Armies</Headline>
          <div className="grid grid-cols-3">
            {allArmies.map((entity, index) => (
              <ArmyViewCard onClick={() => toggleModal(<ArmyActions army={entity} />)} key={index} army={entity} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const ArmyActions = ({ army }: { army: ArmyAndName }) => {
  const clickedHex = useUIStore((state) => state.clickedHex);
  const { col: x, row: y } = clickedHex!.contractPos;

  const { allArmies, userArmies } = usePositionArmies({ position: { x, y } });

  const { formattedRealmsAtPosition } = useStructuresPosition({ position: { x, y } });

  const filteredArmies = useMemo(() => {
    return allArmies.filter((entity) => entity.entity_id !== army.entity_id);
  }, [allArmies]);

  const [selectedArmyToAttack, setSelectedArmyToAttack] = useState<any>(null);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
    },
  } = useDojo();

  return (
    <ModalContainer>
      <div className="text-center">
        <h2>Combat</h2>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-3 gap-8 container ">
          <div>
            <Headline className="my-3">
              <h4> Your Army</h4>
            </Headline>
            <ArmyViewCard army={army} />
          </div>

          <div className="">
            <Headline className="my-3">
              <h4>Attackable</h4>
            </Headline>
            {filteredArmies.length !== 0 ? (
              <>
                <div className="grid grid-cols-1">
                  {filteredArmies.map((entity, index) => (
                    <ArmyViewCard
                      active={entity.entity_id == selectedArmyToAttack}
                      onClick={setSelectedArmyToAttack}
                      key={index}
                      army={entity}
                    />
                  ))}
                </div>
              </>
            ) : (
              ""
            )}
            <div className="grid ">
              {formattedRealmsAtPosition.map((realm, index) => (
                // <RealmListItem key={realm.entity_id} realm={realm} />
                <RealmViewCard
                  self={false}
                  onPillage={() =>
                    provider.battle_pillage({ signer: account, army_id: army.entity_id, structure_id: realm.entity_id })
                  }
                  onSiege={() =>
                    provider.battle_pillage({ signer: account, army_id: army.entity_id, structure_id: realm.entity_id })
                  }
                  key={index}
                  realm={realm}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="w-full my-8 flex justify-center">
        {selectedArmyToAttack && (
          <Button
            onClick={() =>
              provider.battle_start({
                signer: account,
                attacking_army_id: army.entity_id,
                defending_army_id: selectedArmyToAttack,
              })
            }
          >
            Start Battle
          </Button>
        )}{" "}
      </div>
    </ModalContainer>
  );
};

export const ModalContainer = ({ children }: { children: React.ReactNode }) => {
  const { toggleModal } = useModal();

  return (
    <div className="p-8 bg-brown text-gold w-full h-full bg-map ">
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => toggleModal(null)}>
          Close
        </Button>
      </div>
      {children}
    </div>
  );
};

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

  return (
    formattedRealmsAtPosition.length > 0 && (
      <>
        <Headline className="my-3">Structures</Headline>

        <div className="grid grid-cols-2">
          {formattedRealmsAtPosition.map((realm, index) => (
            <RealmListItem key={realm.entity_id} realm={realm} />
            // <RealmViewCard
            //   self={entity.self}
            //   onPillage={() =>
            //     provider.battle_start({ signer: account, attacking_army_id: 43n, defending_army_id: 95n })
            //   }
            //   onSiege={() =>
            //     provider.battle_pillage({ signer: account, army_id: selectedArmy, structure_id: entity.entity_id })
            //   }
            //   key={index}
            //   realm={entity}
            // />
          ))}
        </div>
      </>
    )
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
