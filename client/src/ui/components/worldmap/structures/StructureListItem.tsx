import { ReactComponent as Sword } from "@/assets/icons/common/cross-swords.svg";
import { ReactComponent as Eye } from "@/assets/icons/common/eye.svg";
import { ReactComponent as Shield } from "@/assets/icons/common/shield.svg";
import { BattleManager } from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getUserArmyInBattle } from "@/hooks/helpers/useArmies";
import { useGetHyperstructureProgress } from "@/hooks/helpers/useHyperstructures";
import { Structure, useIsStructureImmune } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useMemo } from "react";
import { TroopDisplay } from "../../military/TroopChip";
import { InventoryResources } from "../../resources/InventoryResources";
import { RealmResourcesIO } from "../../resources/RealmResourcesIO";

type StructureListItemProps = {
  structure: Structure;
  setShowMergeTroopsPopup: (show: boolean) => void;
  ownArmySelected: ArmyInfo | undefined;
  maxInventory?: number;
  showButtons?: boolean;
};

const immuneTooltipContent = (
  <>
    This structure is currently immune to attacks.
    <br />
    During this period, you are also unable to attack other players.
  </>
);

export const StructureListItem = ({
  structure,
  setShowMergeTroopsPopup,
  ownArmySelected,
  maxInventory = Infinity,
  showButtons = false,
}: StructureListItemProps) => {
  const dojo = useDojo();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const setBattleView = useUIStore((state) => state.setBattleView);

  const getHyperstructureProgress = useGetHyperstructureProgress();

  const progress =
    structure.category === StructureType[StructureType.Hyperstructure]
      ? getHyperstructureProgress(structure.entity_id)
      : undefined;

  const battleManager = useMemo(() => new BattleManager(structure.protector?.battle_id || 0, dojo), [structure]);

  const { updatedBattle } = useMemo(() => {
    if (!nextBlockTimestamp) throw new Error("Current timestamp is undefined");
    const updatedBattle = battleManager.getUpdatedBattle(nextBlockTimestamp!);
    return { updatedBattle };
  }, [nextBlockTimestamp]);

  const userArmyInBattle = getUserArmyInBattle(updatedBattle?.entity_id || 0);

  const isImmune = useIsStructureImmune(structure, nextBlockTimestamp!);

  const battleButtons = useMemo(() => {
    if (!nextBlockTimestamp) throw new Error("Current timestamp is undefined");
    const isBattleOngoing = battleManager.isBattleOngoing(nextBlockTimestamp);
    const eyeButton = (
      <Eye
        key={"eye-0"}
        className="fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125"
        onClick={() =>
          setBattleView({
            battleEntityId: updatedBattle!.entity_id,
            targetArmy: undefined,
            ownArmyEntityId: undefined,
          })
        }
      />
    );

    const shieldButton = (
      <Shield
        key={"shield-1"}
        className="fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125"
        onClick={() => setShowMergeTroopsPopup(true)}
      />
    );

    const swordButton = (
      <Sword
        key={"sword-2"}
        className={clsx("fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125", {
          "opacity-50": isImmune,
        })}
        onClick={() => {
          if (!isImmune) {
            setBattleView({
              battleEntityId: updatedBattle?.entity_id,
              targetArmy: structure.protector?.entity_id,
              ownArmyEntityId: ownArmySelected?.entity_id,
            });
          }
        }}
        onMouseEnter={() => {
          if (isImmune) {
            setTooltip({
              content: immuneTooltipContent,
              position: "top",
            });
          }
        }}
        onMouseLeave={() => setTooltip(null)}
      />
    );
    if (!ownArmySelected && !isBattleOngoing) {
      return [];
    }
    if (!ownArmySelected) {
      return [eyeButton];
    }
    if (isBattleOngoing) {
      return [swordButton];
    } else {
      if (structure.isMine) {
        return [shieldButton];
      }
      if (userArmyInBattle) {
        return [eyeButton];
      }
      return [
        <Sword
          key={"sword-2"}
          className={clsx("fill-gold h-6 w-6 my-auto animate-slow transition-all hover:fill-gold/50 hover:scale-125", {
            "opacity-50": isImmune,
          })}
          onClick={() => {
            if (!isImmune) {
              setBattleView({
                engage: true,
                battleEntityId: undefined,
                ownArmyEntityId: ownArmySelected?.entity_id,
                targetArmy: structure.protector?.entity_id,
              });
            }
          }}
          onMouseEnter={() => {
            if (isImmune) {
              setTooltip({
                content: immuneTooltipContent,
                position: "top",
              });
            }
          }}
          onMouseLeave={() => setTooltip(null)}
        />,
      ];
    }
  }, [nextBlockTimestamp, userArmyInBattle, ownArmySelected, updatedBattle, setBattleView, setShowMergeTroopsPopup]);

  return (
    <div className="flex justify-between flex-row mt-2 ">
      <div
        className={`flex w-[27rem] h-full justify-between  ${
          structure.isMine ? "bg-blueish/20" : "bg-red/20"
        } rounded-md border-gold/20 p-2`}
      >
        <div className="flex w-full justify-between">
          <div className="flex flex-col w-[45%] justify-between">
            <div className="h4 text-xl flex flex-row justify-between ">
              <div className="mr-2 text-base">{structure.name}</div>
            </div>
            {structure.category === StructureType[StructureType.Hyperstructure] && (
              <div className="text-xs">Progress: {progress?.percentage ?? 0}%</div>
            )}

            {structure.category === StructureType[StructureType.Realm] && (
              <RealmResourcesIO realmEntityId={structure.entity_id} />
            )}
          </div>
          <div className="flex flex-col content-center w-[55%]">
            <TroopDisplay troops={updatedBattle?.defence_army?.troops || structure.protector?.troops} />
            <InventoryResources
              max={maxInventory}
              entityId={structure.entity_id}
              className="flex gap-1 h-14 mt-2 overflow-x-auto no-scrollbar"
              resourcesIconSize="xs"
              dynamic={
                structure.category === StructureType[StructureType.FragmentMine] ? [ResourcesIds.AncientFragment] : []
              }
            />
          </div>
        </div>
      </div>
      {showButtons && battleButtons}
    </div>
  );
};
