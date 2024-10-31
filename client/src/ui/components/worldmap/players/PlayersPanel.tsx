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

  const playersWithStructures = useMemo(() => {
    const playersByRank = LeaderboardManager.instance().getPlayersByRank(useUIStore.getState().nextBlockTimestamp!);

    const players = getPlayers();
    const playersWithStructures = players.map((player) => {
      const index = playersByRank.findIndex(([address, _]) => BigInt(address) === player.address);

      const structuresEntityIds = runQuery([
        Has(Structure),
        HasValue(Owner, { address: ContractAddress(player.address) }),
      ]);
      const structures = Array.from(structuresEntityIds).map((entityId) => {
        const structure = getComponentValue(Structure, entityId);
        if (!structure) return undefined;

        const structureName = getEntityName(structure.entity_id);
        return {
          structureName,
          structure,
        };
      });

      let isInvited = false;
      if (userGuild) {
        isInvited =
          getComponentValue(GuildWhitelist, getEntityIdFromKeys([player.address, BigInt(userGuild?.guildEntityId)]))
            ?.is_whitelisted ?? false;
      }
      return {
        name: player.addressName,
        address: player.address,
        structures,
        isUser: player.address === ContractAddress(account.address),
        rank: "#" + (index != -1 ? String(index + 1) : "NA"),
        points: index != -1 ? playersByRank[index][1] : 0,
        isInvited,
      };
    });
    return playersWithStructures;
  }, [getPlayers, isLoading]);

  const filteredPlayers = useMemo(() => {
    return playersWithStructures.filter(
      (player) =>
        player.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        player.structures.some(
          (structure) => structure && structure.structureName.toLowerCase().includes(searchInput.toLowerCase()),
        ) ||
        toHexString(player.address).toLowerCase().includes(searchInput.toLowerCase()),
    );
  }, [playersWithStructures, searchInput]);

  const whitelistPlayer = (address: ContractAddress) => {
    setIsLoading(true);
    whitelist_player({
      player_address_to_whitelist: address,
      guild_entity_id: userGuild?.guildEntityId!,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const removePlayerFromWhitelist = (address: ContractAddress) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: address,
      guild_entity_id: userGuild?.guildEntityId!,
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
  // TODO: replace any
  players: any;
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
        {players.map((player: any) => (
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
  player: any;
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
    <div className="flex flex-row grid grid-cols-6">
      <div
        className={clsx("col-span-5 grid grid-cols-5  gap-1 text-md hover:opacity-70 hover:border p-1 rounded-xl", {
          "bg-blueish/20": player.isUser,
        })}
        onClick={onClick}
      >
        <p>{player.rank}</p>
        <p className="col-span-2 truncate">{player.name}</p>
        <p className="text-right">{currencyIntlFormat(player.points)}</p>
        <p className="text-right">{player.structures.length}</p>
      </div>
      {isGuildMaster &&
        !player.isUser &&
        (player.isInvited ? (
          <Button className="px-0 py-0 w-6 m-auto" isLoading={isLoading}>
            <Trash
              onClick={() => {
                removePlayerFromWhitelist(player.address);
                setTooltip(null);
              }}
              className="fill-red/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onMouseEnter={() =>
                setTooltip({
                  content: <div>Revoke guild invitation</div>,
                  position: "top",
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          </Button>
        ) : (
          <Button className="px-0 py-0 w-6 m-auto" isLoading={isLoading}>
            <Invite
              onClick={() => {
                whitelistPlayer(player.address);
                setTooltip(null);
              }}
              className="fill-gold/70 hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onMouseEnter={() =>
                setTooltip({
                  content: <div>Invite to guild</div>,
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
