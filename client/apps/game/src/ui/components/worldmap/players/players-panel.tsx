import { PlayerCustom, PlayerList } from "@/ui/components/worldmap/players/player-list";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import {
  ContractAddress,
  getEntityName,
  getGuildFromPlayerAddress,
  PlayerInfo,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { KeyboardEvent, useMemo, useState } from "react";

export const PlayersPanel = ({
  players,
  viewPlayerInfo,
}: {
  players: PlayerInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
}) => {
  const {
    setup: {
      components,
      systemCalls: { whitelist_player, remove_player_from_whitelist },
    },
    account: { account },
  } = useDojo();

  const { Structure, GuildWhitelist } = components;

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), components);

  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const playersWithStructures: PlayerCustom[] = useMemo(() => {
    // Sort players by points in descending order
    const sortedPlayers = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));

    const playersWithStructures = sortedPlayers.map((player, index) => {
      const structuresEntityIds = runQuery([HasValue(Structure, { owner: ContractAddress(player.address) })]);
      const structures = Array.from(structuresEntityIds)
        .map((entityId) => {
          const structure = getComponentValue(Structure, entityId);
          if (!structure) return undefined;

          const structureName = getEntityName(structure.entity_id, components);
          return structureName;
        })
        .filter((structure): structure is string => structure !== undefined);

      const guild = getGuildFromPlayerAddress(player.address, components);

      let isInvited = false;
      if (userGuild) {
        isInvited =
          getComponentValue(GuildWhitelist, getEntityIdFromKeys([player.address, BigInt(userGuild?.entityId)]))
            ?.is_whitelisted ?? false;
      }
      return {
        ...player,
        structures,
        isUser: player.address === ContractAddress(account.address),
        points: player.points || 0,
        rank: index + 1,
        isInvited,
        guild,
      };
    });
    return playersWithStructures;
  }, [isLoading, players]);

  const filteredPlayers = useMemo(() => {
    const normalizedTerm = normalizeDiacriticalMarks(searchTerm.toLowerCase());

    return searchTerm === ""
      ? playersWithStructures
      : playersWithStructures.filter((player) => {
          const nameMatch = normalizeDiacriticalMarks(player.name.toLowerCase()).includes(normalizedTerm);
          if (nameMatch) return true;

          const addressMatch = toHexString(player.address).toLowerCase().includes(normalizedTerm);
          if (addressMatch) return true;

          return player.structures.some(
            (structure) => structure && normalizeDiacriticalMarks(structure.toLowerCase()).includes(normalizedTerm),
          );
        });
  }, [playersWithStructures, searchTerm]);

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

  const handleSearch = () => {
    setSearchTerm(inputValue);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="flex flex-col min-h-72 p-2 h-full w-full overflow-hidden">
      <div className="flex mb-4">
        <TextInput
          placeholder="Search players/realms/structures..."
          onChange={(value) => setInputValue(value)}
          onKeyDown={handleKeyDown}
          className="flex-1 button-wood"
        />
        <Button onClick={handleSearch} variant="primary">
          Search
        </Button>
      </div>

      <div className="flex-1 min-h-0">
        <PlayerList
          players={filteredPlayers}
          viewPlayerInfo={viewPlayerInfo}
          isGuildMaster={userGuild?.isOwner ?? false}
          whitelistPlayer={whitelistPlayer}
          removePlayerFromWhitelist={removePlayerFromWhitelist}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
