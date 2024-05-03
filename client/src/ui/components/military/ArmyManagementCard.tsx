import { currencyFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import { useDojo } from "@/hooks/context/DojoContext";
import { useResourceBalance } from "@/hooks/helpers/useResources";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { ResourcesIds } from "@bibliothecadao/eternum";
import { useEffect, useState } from "react";
import { useComponentValue } from "@dojoengine/react";
import { shortString } from "starknet";
import { NumberInput } from "@/ui/elements/NumberInput";

export const nameMapping: { [key: number]: string } = {
  [ResourcesIds.Knight]: "Knight",
  [ResourcesIds.Crossbowmen]: "Crossbowman",
  [ResourcesIds.Paladin]: "Paladin",
};

export const ArmyManagementCard = ({ owner_entity, entity }: any) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { create_army, army_buy_troops },
      components: { EntityName },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState(false);

  const [naming, setNaming] = useState("");
  const [troopCounts, setTroopCounts] = useState<{ [key: number]: number }>({
    [ResourcesIds.Knight]: 0,
    [ResourcesIds.Crossbowmen]: 0,
    [ResourcesIds.Paladin]: 0,
  });

  const handleTroopCountChange = (troopName: number, count: number) => {
    setTroopCounts((prev) => ({ ...prev, [troopName]: count }));
  };

  const handleBuyArmy = async () => {
    setIsLoading(true);
    army_buy_troops({
      signer: account,
      army_id: entity.entity_id,
      payer_id: owner_entity,
      troops: {
        knight_count: troopCounts[ResourcesIds.Knight] * 1000 || 0,
        paladin_count: troopCounts[ResourcesIds.Paladin] * 1000 || 0,
        crossbowman_count: troopCounts[ResourcesIds.Crossbowmen] * 1000 || 0,
      },
    }).finally(() => setIsLoading(false));
  };

  const { getBalance } = useResourceBalance();

  useEffect(() => {
    let canCreate = true;
    Object.keys(troopCounts).forEach((troopId) => {
      const count = troopCounts[Number(troopId)];
      const balance = getBalance(owner_entity, Number(troopId)).balance;
      if (count > balance) {
        canCreate = false;
      }
    });

    if (
      troopCounts[ResourcesIds.Knight] === 0 &&
      troopCounts[ResourcesIds.Crossbowmen] === 0 &&
      troopCounts[ResourcesIds.Paladin] === 0
    ) {
      canCreate = false;
    }
    setCanCreate(canCreate);
  }, [troopCounts]);

  const name = useComponentValue(EntityName, getEntityIdFromKeys([BigInt(entity.entity_id)]));
  const [editName, setEditName] = useState(false);

  const troops = [
    {
      name: ResourcesIds.Knight,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Paladin",
      weak: "Crossbowmen",
      current: currencyFormat(entity.troops.knight_count, 0),
    },
    {
      name: ResourcesIds.Crossbowmen,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Knight",
      weak: "Paladin",
      current: currencyFormat(entity.troops.crossbowman_count, 0),
    },
    {
      name: ResourcesIds.Paladin,
      cost: 10,
      attack: 10,
      defense: 10,
      strong: "Crossbowmen",
      weak: "Knight",
      current: currencyFormat(entity.troops.paladin_count, 0),
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex justify-between border-b py-2">
        {editName ? (
          <div className="flex space-x-2">
            <TextInput
              placeholder="Type Name"
              className="h-full border"
              value={naming}
              onChange={(name) => setNaming(name)}
            />
            <Button
              variant="primary"
              isLoading={isLoading}
              onClick={async () => {
                setIsLoading(true);

                try {
                  await provider.set_entity_name({ signer: account, entity_id: entity.entity_id, name: naming });
                } catch (e) {
                  console.error(e);
                }

                setIsLoading(false);
                setEditName(false);
              }}
            >
              Change Name
            </Button>
          </div>
        ) : (
          <h3>Army - {name ? shortString.decodeShortString(name.name.toString()) : "Army"}</h3>
        )}
        <Button size="xs" variant="outline" onClick={() => setEditName(!editName)}>
          edit name
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 my-2">
        {troops.map((troop) => (
          <div className="p-2 border" key={troop.name}>
            <img src={`/images/units/${nameMapping[troop.name]}.png`} alt={nameMapping[troop.name]} />
            <h5 className="font-bold">
              {nameMapping[troop.name]} [{troop.current}]
            </h5>
            <div className="flex justify-between border px-2 uppercase my-2 font-bold">
              <div>Atk: {troop.attack}</div>
              <div>Def: {troop.defense}</div>
            </div>

            <div className="my-3">
              <div>Str vs {troop.strong}</div>
              <div>Wk vs {troop.weak}</div>
            </div>

            <div className="flex">
              <NumberInput
                max={Number(
                  currencyFormat(
                    getBalance(owner_entity, troop.name).balance
                      ? Number(getBalance(owner_entity, troop.name).balance)
                      : 0,
                    2,
                  ),
                )}
                min={0}
                value={troopCounts[troop.name]}
                onChange={(amount) => handleTroopCountChange(troop.name, amount)}
              />
              <div className="px-2">
                [
                {Number(
                  currencyFormat(
                    getBalance(owner_entity, troop.name).balance
                      ? Number(getBalance(owner_entity, troop.name).balance)
                      : 0,
                    2,
                  ),
                )}
                ]
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* <div className="mb-3 border p-2">
        <h4>Enlisting</h4>
        <div>
          {nameMapping[ResourcesIds.Knight]}: {troopCounts[ResourcesIds.Knight]}
        </div>
        <div>
          {nameMapping[ResourcesIds.Crossbowmen]}: {troopCounts[ResourcesIds.Crossbowmen]}
        </div>
        <div>
          {nameMapping[ResourcesIds.Paladin]}: {troopCounts[ResourcesIds.Paladin]}
        </div>
      </div> */}
      <hr />
      <Button className="w-full " disabled={!canCreate} variant="primary" isLoading={isLoading} onClick={handleBuyArmy}>
        Enlist Army
      </Button>
    </div>
  );
};
