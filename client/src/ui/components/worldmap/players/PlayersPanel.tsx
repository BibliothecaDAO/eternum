import { ReactComponent as Invite } from "@/assets/icons/common/envelope.svg";
import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useEntitiesUtils } from "@/hooks/helpers/useEntities";
import { useGetAllPlayers } from "@/hooks/helpers/useGetAllPlayers";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, getEntityIdFromKeys, toHexString } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import clsx from "clsx";
import { useMemo, useState } from "react";

interface Player {
  name: string;
  address: ContractAddress;
  structures: string[];
  isUser: boolean;
  rank: string;
  points: number;
  isInvited: boolean;
}

export const PlayersPanel = ({ viewPlayerInfo }: { viewPlayerInfo: (playerAddress: ContractAddress) => void }) => {
  const {
    setup: {
      components: { Structure, Owner, GuildWhitelist },
      systemCalls: { whitelist_player, remove_player_from_whitelist },
    },
    account: { account },
  } = useDojo();

  const { getGuildFromPlayerAddress } = useGuilds();

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address));

  const [isLoading, setIsLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");

  const { getEntityName } = useEntitiesUtils();
  const getPlayers = useGetAllPlayers();

  const playersWithStructures: Player[] = useMemo(() => {
    const playersByRank = LeaderboardManager.instance().getPlayersByRank(useUIStore.getState().nextBlockTimestamp!);

    const players = getPlayers();
    const playersWithStructures = players
      .map((player) => {
        const rankIndex = playersByRank.findIndex(([address, _]) => BigInt(address) === player.address);

        const structuresEntityIds = runQuery([
          Has(Structure),
          HasValue(Owner, { address: ContractAddress(player.address) }),
        ]);
        const structures = Array.from(structuresEntityIds)
          .map((entityId) => {
            const structure = getComponentValue(Structure, entityId);
            if (!structure) return undefined;

            const structureName = getEntityName(structure.entity_id);
            return structureName;
          })
          .filter((structure) => structure !== undefined);

        let isInvited = false;
        if (userGuild) {
          isInvited =
            getComponentValue(GuildWhitelist, getEntityIdFromKeys([player.address, BigInt(userGuild?.entityId)]))
              ?.is_whitelisted ?? false;
        }
        return {
          name: player.addressName,
          address: player.address,
          structures,
          isUser: player.address === ContractAddress(account.address),
          rank: "#" + (rankIndex != -1 ? String(rankIndex + 1) : "NA"),
          points: rankIndex != -1 ? playersByRank[rankIndex][1] : 0,
          isInvited,
        };
      })
      .sort((a, b) => {
        const rankA = parseInt(a!.rank.substring(1)) || Infinity;
        const rankB = parseInt(b!.rank.substring(1)) || Infinity;
        return rankA - rankB;
      })
      .map((player, index) => {
        if (player.rank === "#NA") {
          player.rank = "#" + (index + 1);
        }
        return player;
      });
    return playersWithStructures;
  }, [getPlayers, isLoading]);

  const filteredPlayers = useMemo(() => {
    return playersWithStructures.filter(
      (player) =>
        player.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        player.structures.some(
          (structure) => structure && structure.toLowerCase().includes(searchInput.toLowerCase()),
        ) ||
        toHexString(player.address).toLowerCase().includes(searchInput.toLowerCase()),
    );
  }, [playersWithStructures, searchInput]);

  const whitelistPlayer = (address: ContractAddress) => {
    setIsLoading(true);
    whitelist_player({
      player_address_to_whitelist: address,
      guild_entity_id: userGuild?.entityId!,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const removePlayerFromWhitelist = (address: ContractAddress) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: address,
      guild_entity_id: userGuild?.entityId!,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col min-h-72 p-2 h-full w-full">
      <TextInput
        placeholder="Search players/realms/structures..."
        onChange={(searchInput) => setSearchInput(searchInput)}
        className="mb-4"
      />

      <PlayerList
        players={filteredPlayers}
        viewPlayerInfo={viewPlayerInfo}
        isGuildMaster={userGuild?.isOwner ?? false}
        whitelistPlayer={whitelistPlayer}
        removePlayerFromWhitelist={removePlayerFromWhitelist}
        isLoading={isLoading}
      />
    </div>
  );
};

interface PlayerListProps {
  players: Player[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  isGuildMaster: boolean;
  whitelistPlayer: (address: ContractAddress) => void;
  removePlayerFromWhitelist: (address: ContractAddress) => void;
  isLoading: boolean;
}

const PlayerList = ({
  players,
  viewPlayerInfo,
  isGuildMaster,
  whitelistPlayer,
  removePlayerFromWhitelist,
  isLoading,
}: PlayerListProps) => {
  return (
    <div className="flex flex-col p-2 border rounded-xl h-full">
      <PlayerListHeader />
      <div className="flex flex-col space-y-2 overflow-y-auto">
        {players.map((player) => (
          <PlayerRow
            key={player.address}
            player={player}
            onClick={() => {
              viewPlayerInfo(ContractAddress(player.address));
            }}
            isGuildMaster={isGuildMaster}
            whitelistPlayer={whitelistPlayer}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
            isLoading={isLoading}
          />
        ))}
      </div>
    </div>
  );
};

const PlayerListHeader = () => {
  return (
    <div className="flex grid grid-cols-6 gap-1 mb-4 uppercase text-xs font-bold border-b">
      <div>Rank</div>
      <div className="col-span-2">Name</div>
      <div className="text-right">Points</div>
      <div className="text-right">Structs</div>
      <div></div>
    </div>
  );
};

interface PlayerRowProps {
  player: Player;
  onClick: () => void;
  isGuildMaster: boolean;
  whitelistPlayer: (address: ContractAddress) => void;
  removePlayerFromWhitelist: (address: ContractAddress) => void;
  isLoading: boolean;
}

const PlayerRow = ({
  player,
  onClick,
  isGuildMaster,
  whitelistPlayer,
  removePlayerFromWhitelist,
  isLoading,
}: PlayerRowProps) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div
      className={clsx("flex flex-row grid grid-cols-6 rounded", {
        "bg-blueish/20": player.isUser,
      })}
    >
      <div className="col-span-5 grid grid-cols-5  gap-1 text-md hover:opacity-70 p-1" onClick={onClick}>
        <p>{player.rank}</p>
        <p className="col-span-2 truncate">{player.name}</p>
        <p className="text-right">{currencyIntlFormat(player.points)}</p>
        <p className="text-right">{player.structures.length}</p>
      </div>
      {isGuildMaster &&
        !player.isUser &&
        (player.isInvited ? (
          <Button className="px-0 py-0" isLoading={isLoading}>
            <Trash
              onClick={() => {
                removePlayerFromWhitelist(player.address);
                setTooltip(null);
              }}
              className="fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onMouseEnter={() =>
                setTooltip({
                  content: <div>Revoke tribe invitation</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          </Button>
        ) : (
          <Button className="px-0 py-0" isLoading={isLoading}>
            <Invite
              onClick={() => {
                whitelistPlayer(player.address);
                setTooltip(null);
              }}
              className="fill-gold/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onMouseEnter={() =>
                setTooltip({
                  content: <div>Invite to tribe</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          </Button>
        ))}
    </div>
  );
};
