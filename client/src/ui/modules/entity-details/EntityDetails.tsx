import { ArmyInfo, useOwnArmiesByPosition } from "@/hooks/helpers/useArmies";
import useUIStore from "@/hooks/store/useUIStore";
import { HintSection } from "@/ui/components/hints/HintModal";
import { ArmyChip } from "@/ui/components/military/ArmyChip";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { Tabs } from "@/ui/elements/tab";
import { Position } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { Battles } from "./Battles";
import { Entities } from "./Entities";

export const EntityDetails = () => {
  const clickedHex = useUIStore((state) => state.clickedHex);

  const hexData = useUIStore((state) => state.hexData);
  const biome = hexData?.[clickedHex?.hexIndex || 0].biome || "undefined";
  const [selectedTab, setSelectedTab] = useState(0);

  const hexPosition = useMemo(() => {
    if (clickedHex) return { x: clickedHex.contractPos.col, y: clickedHex.contractPos.row };
  }, [clickedHex]);

  const ownArmiesAtPosition = useOwnArmiesByPosition({
    position: { x: hexPosition?.x || 0, y: hexPosition?.y || 0 },
    inBattle: false,
  });

  const tabs = useMemo(
    () => [
      {
        key: "entities",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Entities</div>
          </div>
        ),
        component: <Entities position={hexPosition!} ownArmiesAtPosition={ownArmiesAtPosition} />,
      },
      {
        key: "battles",
        label: (
          <div className="flex relative group flex-col items-center">
            <div>Battles</div>
          </div>
        ),
        component: <Battles position={hexPosition!} ownArmiesAtPosition={ownArmiesAtPosition} />,
      },
    ],
    [clickedHex, ownArmiesAtPosition],
  );

  return (
    hexPosition && (
      <div className="px-2 h-full">
        <CoordinatesAndBiome position={hexPosition} />

        <Tabs selectedIndex={selectedTab} onChange={(index: any) => setSelectedTab(index)} className="h-full">
          <Tabs.List>
            {tabs.map((tab, index) => (
              <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
            ))}
          </Tabs.List>
          <Tabs.Panels className="">
            {tabs.map((tab, index) => (
              <Tabs.Panel key={index} className="h-full">
                {tab.component}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      </div>
    )
  );
};

export const SelectActiveArmy = ({
  selectedEntity,
  setOwnArmySelected,
  userAttackingArmies,
}: {
  selectedEntity:
    | {
        id: bigint;
        position: Position;
      }
    | undefined;
  setOwnArmySelected: (val: any) => void;
  userAttackingArmies: ArmyInfo[];
}) => {
  return (
    <div className="w-[31rem]">
      <Select
        value={selectedEntity?.id.toString() || ""}
        onValueChange={(a: string) => {
          setOwnArmySelected({ id: BigInt(a), position: selectedEntity?.position || { x: 0, y: 0 } });
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

const CoordinatesAndBiome = ({ position }: { position: Position }) => {
  return (
    <div className="p-2 flex justify-between text-xs">
      <div className="font-bold flex space-x-2 justify-between self-center ">
        <div>{`x: ${position.x?.toLocaleString()}`}</div>
        <div>{`y: ${position.y?.toLocaleString()}`}</div>
      </div>
      <HintModalButton className="top-1 right-1" section={HintSection.Combat} />
    </div>
  );
};
