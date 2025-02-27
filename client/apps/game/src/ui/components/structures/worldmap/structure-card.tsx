import { useNavigateToHexView } from "@/hooks/helpers/use-navigate";
import { Position } from "@/types/position";
import { ResourceExchange } from "@/ui/components/hyperstructures/resource-exchange";
import { ImmunityTimer } from "@/ui/components/worldmap/structures/immunity-timer";
import { StructureListItem } from "@/ui/components/worldmap/structures/structure-list-item";
import Button from "@/ui/elements/button";
import { Headline } from "@/ui/elements/headline";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/elements/tabs";
import {
  ArmyInfo,
  ContractAddress,
  getGuildFromPlayerAddress,
  getStructureAtPosition,
  ID,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import clsx from "clsx";
import { useMemo, useState } from "react";

export const StructureCard = ({
  className,
  position,
  ownArmySelected,
}: {
  className?: string;
  position: Position;
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const dojo = useDojo();

  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);

  const navigateToHexView = useNavigateToHexView();

  const structure = useMemo(
    () =>
      getStructureAtPosition(
        position.getContract(),
        ContractAddress(dojo.account.account.address),
        dojo.setup.components,
      ),
    [position, dojo.account.account.address, dojo.setup.components],
  );

  const playerGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(structure?.owner || 0n), dojo.setup.components),
    [structure?.owner],
  );

  return (
    structure && (
      <div className={`px-2 py-2 ${className}`}>
        <div className="ml-2">
          <Button
            variant="outline"
            size="xs"
            className={clsx("self-center")}
            onClick={() => {
              navigateToHexView(position);
            }}
          >
            View {structure?.structure.base.category}
          </Button>
        </div>
        {!showMergeTroopsPopup && (
          <>
            <Headline className="text-center text-lg">
              <div>{structure?.ownerName}</div>
              {playerGuild && (
                <div>
                  {"< "}
                  {playerGuild.name}
                  {" >"}
                </div>
              )}
            </Headline>
            <StructureListItem
              structure={structure!}
              ownArmySelected={ownArmySelected}
              setShowMergeTroopsPopup={setShowMergeTroopsPopup}
              showButtons={true}
            />
            <ImmunityTimer structure={structure} className="w-[27rem]" />
          </>
        )}
        {showMergeTroopsPopup && (
          <div className="flex flex-col mt-2">
            {ownArmySelected && (
              <StructureMergeTroopsPanel
                giverArmy={ownArmySelected}
                setShowMergeTroopsPopup={setShowMergeTroopsPopup}
                structureEntityId={structure!.entityId}
              />
            )}
          </div>
        )}
      </div>
    )
  );
};

type MergeTroopsPanelProps = {
  giverArmy: ArmyInfo;
  takerArmy?: ArmyInfo;
  setShowMergeTroopsPopup: (val: boolean) => void;
  structureEntityId?: ID;
};

const StructureMergeTroopsPanel = ({
  giverArmy,
  setShowMergeTroopsPopup,
  structureEntityId,
  takerArmy,
}: MergeTroopsPanelProps) => {
  return (
    <div className="flex flex-col  bg-gold/20 p-3 max-h-[42vh] overflow-y-auto">
      <Button className="mb-3 w-[30%]" variant="default" size="xs" onClick={() => setShowMergeTroopsPopup(false)}>
        &lt; Back
      </Button>
      <TroopExchange
        giverArmyName={giverArmy.name}
        takerArmy={takerArmy}
        giverArmyEntityId={giverArmy.entityId}
        structureEntityId={structureEntityId}
      />
    </div>
  );
};

type TroopsProps = {
  giverArmyName: string;
  takerArmy?: ArmyInfo;
  giverArmyEntityId: ID;
  structureEntityId?: ID;
  allowReverse?: boolean;
};

export const Exchange = ({
  giverArmyName,
  giverArmyEntityId,
  structureEntityId,
  takerArmy,
  allowReverse,
}: TroopsProps) => {
  return (
    <Tabs defaultValue="troops" className="w-full">
      <TabsList className="grid w-full grid-cols-2 gap-4">
        <TabsTrigger value="troops" className="border hover:opacity-70">
          Troops
        </TabsTrigger>
        <TabsTrigger value="resources" className="border hover:opacity-70">
          Resources
        </TabsTrigger>
      </TabsList>
      <TabsContent value="troops">
        <TroopExchange
          giverArmyName={giverArmyName}
          giverArmyEntityId={giverArmyEntityId}
          structureEntityId={structureEntityId}
          takerArmy={takerArmy}
          allowReverse={allowReverse}
        />
      </TabsContent>
      <TabsContent value="resources">
        <ResourceExchange
          giverArmyName={giverArmyName}
          giverArmyEntityId={giverArmyEntityId}
          structureEntityId={structureEntityId}
          takerArmy={takerArmy}
          allowReverse={allowReverse}
        />
      </TabsContent>
    </Tabs>
  );
};

const TroopExchange = ({
  giverArmyName,
  giverArmyEntityId,
  structureEntityId,
  takerArmy,
  allowReverse,
}: TroopsProps) => {
  return (
    <div>
      <div>Troop exchange functionality is currently a work in progress...</div>
    </div>
  );
};
