import { canIssueOrders } from "@/utils/can-issue-orders";
import { PlayerList, type PlayerCustom } from "./player-list";
import { getGuildFromPlayerAddress, isViewerOwner } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { useMemo, useState } from "react";

export const PlayersPanel = ({
  players,
  viewPlayerInfo,
  focusOwnPlayer = false,
}: {
  players: PlayerInfo[];
  focusOwnPlayer?: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
}) => {
  const {
    setup: {
      systemCalls: { update_whitelist },
    },
    account: { account },
  } = useGame();

  const facts = useNativeFacts(["Structure", "Guild", "GuildMember"]);

  const [isLoading, setIsLoading] = useState(false);
  const listedPlayers: PlayerCustom[] = useMemo(
    () =>
      players
        .filter((player) => player.address !== 0n)
        .map((player) => ({
          ...player,
          isUser: isViewerOwner(player.address, ContractAddress(account.address)),
          guild: getGuildFromPlayerAddress(player.address, facts.store),
        })),
    [facts, account.address, players],
  );

  const whitelistPlayer = (address: ContractAddress) => {
    if (!canIssueOrders()) return;
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: true,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col p-2">
      <PlayerList
        players={listedPlayers}
        focusOwnPlayer={focusOwnPlayer}
        viewPlayerInfo={viewPlayerInfo}
        whitelistPlayer={whitelistPlayer}
        isLoading={isLoading}
      />
    </div>
  );
};
