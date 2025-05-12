import { useMinigameStore } from "@/hooks/store/use-minigame-store";
import { BuildingThumbs } from "@/ui/config";
import { formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo } from "react";

const formatAmount = (amount: number) => {
  return Intl.NumberFormat("en-US", {
    notation: amount < 0.01 ? "standard" : "compact",
    maximumFractionDigits: amount < 0.01 ? 6 : 2,
  }).format(amount);
};

export const InfoContainer = ({ targetHex }: { targetHex: { x: number; y: number } }) => {
  const {
    setup: {
      components: { QuestTile, QuestLevels, Tile },
    },
  } = useDojo();
  const { minigames, settingsMetadata } = useMinigameStore();

  const targetEntity = getComponentValue(Tile, getEntityIdFromKeys([BigInt(targetHex.x), BigInt(targetHex.y)]));
  const questTileEntity = getComponentValue(QuestTile, getEntityIdFromKeys([BigInt(targetEntity?.occupier_id || 0)]));
  const questLevelsEntity = getComponentValue(
    QuestLevels,
    getEntityIdFromKeys([BigInt(questTileEntity?.game_address || 0)]),
  );
  const questLevels = questLevelsEntity?.levels ?? [];

  const remainingQuestCapacity = useMemo(() => {
    return (questTileEntity?.capacity ?? 0) - (questTileEntity?.participant_count ?? 0);
  }, [questTileEntity]);

  const fullCapacity = useMemo(() => {
    return remainingQuestCapacity <= 0;
  }, [remainingQuestCapacity]);

  const gameAddress = useMemo(() => questLevelsEntity?.game_address ?? "0x0", [questLevelsEntity]);

  const miniGameInfo = minigames?.find((game) => game.contract_address === gameAddress);

  return (
    <div className="flex flex-col gap-5 items-center border border-gold/20 rounded-lg p-5 h-full w-3/4 mx-auto">
      <div className="flex flex-col gap-2 items-center w-full pt-2">
        <div className="flex flex-col items-center gap-2 border panel-wood py-2 px-5">
          <div className="flex flex-col items-center">
            <span className="font-bold">Game</span>
            <span className="text-sm">{miniGameInfo?.name}</span>
          </div>
          <div className="border-t border-gold/40 w-32" />
          <div className="flex flex-col items-center">
            <span className="font-bold">Developer</span>
            <span className="text-sm">{miniGameInfo?.developer}</span>
          </div>
          <div className="border-t border-gold/40 w-32" />
          <div className="flex flex-col items-center">
            <span className="font-bold">Description</span>
            <span className="text-sm text-center">{miniGameInfo?.description}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-row items-center justify-center gap-2 relative border-t border-gold/20 pt-5 w-full">
        <span className="font-bold uppercase">Remaining Quests ON TILE:</span>
        <span className={`text-2xl font-bold ${remainingQuestCapacity < 100 ? "text-red" : "text-green"}`}>
          {fullCapacity ? "AT CAPACITY" : remainingQuestCapacity}
        </span>
      </div>
      <div className="flex flex-col gap-2 items-center w-full border-t border-gold/20 pt-5">
        <div className="font-bold uppercase">Available Levels</div>
        <div className="flex flex-row gap-5 p-5 w-full overflow-x-auto border border-gold/50 rounded-lg">
          {questLevels.map((level: any, i: number) => {
            const timeLimit = level?.value?.time_limit?.value;
            const targetScore = level?.value?.target_score?.value;
            const settingsId = level?.value?.settings_id?.value;
            const settingsMetadataForGame = useMemo(
              () => settingsMetadata?.[gameAddress],
              [settingsMetadata, gameAddress],
            );

            const settingName = settingsMetadataForGame
              ?.find((setting) => setting.settings_id === settingsId)
              ?.name.split("Eternum Quest -")[1];

            return (
              <div className="flex flex-col gap-2 items-center justify-center border border-gold rounded-lg p-1 h-[90px] w-[200px] flex-shrink-0">
                <div className="flex flex-row items-center justify-between text-sm w-full px-2">
                  <span className="font-bold">{settingName}</span>
                  <div
                    className="flex flex-row items-center gap-2 text-[12px] relative group"
                    onClick={() =>
                      window.open(
                        `https://darkshuffle.dev/settings/${Number(level?.value?.settings_id?.value)}`,
                        "_blank",
                      )
                    }
                  >
                    <span className="text-[10px] text-gold">View Settings</span>
                    <div className="absolute -bottom-12 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown border border-gold rounded-lg w-max group-hover:flex px-2">
                      <div className="flex flex-row items-center gap-1">
                        <span className="text-sm">See Settings</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-row gap-2 border border-gold/20 bg-gold/10 px-2 w-full">
                  <div className="flex flex-col items-center text-sm w-1/3 relative group">
                    <span>Reward</span>
                    <div className="flex flex-row items-center gap-2">
                      <img src={BuildingThumbs.resources} className="w-4 h-4 self-center" />
                      <span className="text-[10px]">+{formatAmount((i + 1) * 7500)}</span>
                    </div>
                    <div className="absolute -top-2 flex-col items-center hidden -translate-y-full left-1/2 -translate-x-1/2 bg-brown border border-gold rounded-lg w-max group-hover:flex px-2">
                      <div className="flex flex-row items-center gap-1">
                        <img src={BuildingThumbs.resources} className="w-4 h-4 self-center" />
                        <span className="text-sm">+{formatAmount((i + 1) * 7500)} Random Resource</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-sm w-1/3">
                    <span>Target</span>
                    <span className="text-[10px]">{targetScore} XP</span>
                  </div>
                  <div className="flex flex-col items-center text-sm w-1/3">
                    <span>Time</span>
                    <span className="text-[10px]">{formatTime(timeLimit)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
