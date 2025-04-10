import { PlayerCustom, PlayerList } from "@/ui/components/worldmap/players/player-list";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import {
  getEntityName,
  getGuildFromPlayerAddress,
  toHexString,
} from "@bibliothecadao/eternum";
import {
  ContractAddress,
  PlayerInfo,
} from "@bibliothecadao/types";
import { useDojo } from "@bibliothecadao/react";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { Search } from "lucide-react";
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
      systemCalls: { update_whitelist },
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
            ?.whitelisted ?? false;
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

    let filteredList = playersWithStructures;

    // Apply search term filter
    if (searchTerm !== "") {
      filteredList = filteredList.filter((player) => {
        const nameMatch = normalizeDiacriticalMarks(player.name.toLowerCase()).includes(normalizedTerm);
        if (nameMatch) return true;

        const addressMatch = toHexString(player.address).toLowerCase().includes(normalizedTerm);
        if (addressMatch) return true;

        return player.structures.some(
          (structure) => structure && normalizeDiacriticalMarks(structure.toLowerCase()).includes(normalizedTerm),
        );
      });
    }

    return filteredList;
  }, [playersWithStructures, searchTerm]);

  const whitelistPlayer = (address: ContractAddress) => {
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: true,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const removePlayerFromWhitelist = (address: ContractAddress) => {
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: false,
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
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2">
          <TextInput
            placeholder="Search players/realms/structures..."
            onChange={(value) => setInputValue(value)}
            onKeyDown={handleKeyDown}
            className="flex-1 button-wood"
          />
          <Button onClick={handleSearch} variant="primary" className="flex items-center gap-1 px-4">
            <Search size={14} />
            <span>Search</span>
          </Button>
        </div>

        {userGuild?.isOwner && (
          <div className="flex justify-between items-center">
            <div className="text-sm text-gold/80">
              {filteredPlayers.length} player{filteredPlayers.length !== 1 ? "s" : ""} found
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 border border-gold/20 rounded-md bg-brown/10">
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
