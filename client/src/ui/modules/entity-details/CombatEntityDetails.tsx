import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, useOwnArmiesByPosition } from "@/hooks/helpers/useArmies";
import { getPlayerStructures } from "@/hooks/helpers/useEntities";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { HintSection } from "@/ui/components/hints/HintModal";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { Battles } from "./Battles";
import { Entities } from "./Entities";

export const CombatEntityDetails = () => {
  const dojo = useDojo();

  const selectedHex = useUIStore((state) => state.selectedHex);

  const [selectedTab, setSelectedTab] = useState(0);
  const [ownArmySelected, setOwnArmySelected] = useState<{ id: ID; position: Position } | undefined>();

  const getStructures = getPlayerStructures();

  const hexPosition = useMemo(() => {
    return new Position({ x: selectedHex.col, y: selectedHex.row });
  }, [selectedHex]);

  const ownArmiesAtPosition = useOwnArmiesByPosition({
    position: { x: selectedHex.col, y: selectedHex.row },
    inBattle: false,
    playerStructures: getStructures(ContractAddress(dojo.account.account.address)),
  });

  const userArmies = useMemo(
    () => ownArmiesAtPosition.filter((army) => army.health.current > 0),
    [ownArmiesAtPosition],
  );

  useEffect(() => {
    if (ownArmySelected) return;
    const firstArmyId = userArmies[0]?.entity_id;
    if (!firstArmyId) return;
    setOwnArmySelected({
      id: firstArmyId,
      position: hexPosition,
    });
  }, [userArmies, selectedHex]);

  const ownArmy = useMemo(() => {
    if (!ownArmySelected) {
      return;
    }
    return userArmies.find((army) => army.entity_id === ownArmySelected.id);
  }, [userArmies, ownArmySelected, selectedHex.col, selectedHex.row]);

  const tabs = useMemo(
    () => [
      {
        key: "entities",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Entities</div>
          </div>
        ),
        component: <Entities position={hexPosition} ownArmy={ownArmy} />,
      },
      {
        key: "battles",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Battles</div>
          </div>
        ),
        component: <Battles position={hexPosition} ownArmy={ownArmy} />,
      },
    ],
    [selectedHex, userArmies, ownArmy?.entity_id, ownArmySelected?.id],
  );

  return (
    hexPosition && (
      <div className="px-2 h-full">
        <HintModalButton className="absolute top-1 right-1" section={HintSection.Combat} />

        <div>
          <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
            <Tabs.List>
              {tabs.map((tab, index) => (
                <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
              ))}
            </Tabs.List>
            {userArmies.length > 0 && (
              <SelectActiveArmy
                selectedEntity={ownArmySelected}
                setOwnArmySelected={setOwnArmySelected}
                userAttackingArmies={userArmies}
              />
            )}

            <Tabs.Panels className="">
              {tabs.map((tab, index) => (
                <Tabs.Panel key={index} className="h-full">
                  {tab.component}
                </Tabs.Panel>
              ))}
            </Tabs.Panels>
          </Tabs>
        </div>
      </div>
    )
  );
};

const SelectActiveArmy = ({
  selectedEntity,
  setOwnArmySelected,
  userAttackingArmies,
}: {
  selectedEntity:
    | {
        id: ID;
        position: Position;
      }
    | undefined;
  setOwnArmySelected: (val: { id: ID; position: Position } | undefined) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  return (
    <div className="w-[31rem]">
      <Select
        value={selectedEntity?.id.toString() || ""}
        onValueChange={(a: string) => {
          setOwnArmySelected({ id: ID(a), position: selectedEntity?.position || new Position({ x: 0, y: 0 }) });
        }}
      >
        <SelectTrigger className="w-[31rem] px-2">
          <SelectValue placeholder="Your armies" />
        </SelectTrigger>
        <SelectContent className="text-gold w-[31rem]">
          {userAttackingArmies.map((army, index) => {
            return (
              <SelectItem
                className="flex justify-between text-sm w-full"
                key={index}
                value={army.entity_id?.toString() || ""}
              >
                <ArmyChip className={`w-[27rem] bg-green/10`} army={army} />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};
