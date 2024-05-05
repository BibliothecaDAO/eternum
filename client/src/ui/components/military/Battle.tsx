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
import { ModalContainer } from "../ModalContainer";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { currencyFormat } from "@/ui/utils/utils";

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

  const { structuresAtPosition } = useStructuresPosition({ position: { x, y } });
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
          <div className="grid grid-cols-2 gap-2">
            {allArmies.map((entity, index) => (
              <ArmyViewCard
                actions={structuresAtPosition}
                onClick={() => {
                  structuresAtPosition ? toggleModal(<ArmyActions army={entity} />) : console.log("no structures");
                }}
                key={index}
                army={entity}
              />
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

  const { formattedRealmAtPosition } = useStructuresPosition({ position: { x, y } });

  const filteredArmies = useMemo(() => {
    return allArmies.filter((entity) => entity.entity_id !== army.entity_id);
  }, [allArmies]);

  const [selectedArmyToAttack, setSelectedArmyToAttack] = useState<any>(null);

  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
      components: { Protector, Army, Health },
    },
  } = useDojo();

  const [loading, setLoading] = useState(false);

  const getProtector = useMemo(() => {
    const protector = getComponentValue(Protector, getEntityIdFromKeys([BigInt(formattedRealmAtPosition.entity_id)]));
    const protectorArmy = getComponentValue(Army, getEntityIdFromKeys([BigInt(protector?.army_id || 0n)]));
    const health = getComponentValue(Health, getEntityIdFromKeys([BigInt(protectorArmy?.entity_id || 0n)]));

    return { ...protectorArmy, ...health };
  }, []);

  console.log(getProtector);

  const handleBattleStart = async () => {
    setLoading(true);

    await provider.battle_start({
      signer: account,
      attacking_army_id: army.entity_id,
      defending_army_id: selectedArmyToAttack,
    });

    setLoading(false);
  };

  const handlePillage = async () => {
    setLoading(true);

    await provider.battle_pillage({
      signer: account,
      army_id: army.entity_id,
      structure_id: formattedRealmAtPosition.entity_id,
    });

    setLoading(false);
  };

  return (
    <ModalContainer>
      <div className="text-center">
        <h2>Combat</h2>
      </div>

      <div className="flex justify-center">
        <div className="grid grid-cols-12 gap-8 container ">
          <div className="col-span-3">
            <Headline className="my-3">
              <h4> Your Army</h4>
            </Headline>
            <ArmyViewCard army={army} />
          </div>
          <div className="border p-8 text-center col-span-6 space-y-8 flex flex-col justify-center">
            <div>
              <Headline>
                <h5>{army.name}</h5>
              </Headline>
              <p>
                You have a fighting chance to steal some resources. If victorious you will steal resources and return
                home.
              </p>
            </div>

            <div>
              {" "}
              <Button isLoading={loading} variant="primary" onClick={() => handlePillage()}>
                Pillage
              </Button>
            </div>

            <div>
              <Headline>
                <h5>{formattedRealmAtPosition.name}</h5>
              </Headline>

              {getProtector ? (
                <>
                  {" "}
                  <h6> {Number(getProtector.current?.toString()) / 1000}HP</h6>
                  <div className="flex justify-center gap-8 mt-4">
                    <div>Crossbowmen: {currencyFormat(getProtector?.troops?.crossbowman_count, 0)}</div>
                    <div>Knight: {currencyFormat(getProtector?.troops?.knight_count, 0)}</div>
                    <div>Paladin: {currencyFormat(getProtector?.troops?.paladin_count, 0)}</div>
                  </div>
                </>
              ) : (
                "No Defending Army"
              )}
            </div>
          </div>

          <div className="col-span-3">
            <Headline className="my-3">
              <h4>Attackable</h4>
            </Headline>
            {/* {filteredArmies.length !== 0 ? (
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
            )} */}
            {formattedRealmAtPosition && (
              <div className="grid ">
                <RealmListItem realm={formattedRealmAtPosition} />
              </div>
            )}
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

export const TroopCard = ({ count, id }: { count: number; id: number }) => {
  return (
    <div className="border p-4">
      <h5>{count}</h5>
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

  const { formattedRealmAtPosition } = useStructuresPosition({ position: { x, y } });
  const { allArmies, userArmies } = usePositionArmies({ position: { x, y } });

  return (
    <>
      <Headline className="my-3">Structures</Headline>

      <div className="grid grid-cols-2">
        {formattedRealmAtPosition && <RealmListItem realm={formattedRealmAtPosition} />}
      </div>
    </>
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
