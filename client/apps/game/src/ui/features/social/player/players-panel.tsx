import { useUIStore } from "@/hooks/store/use-ui-store";
import { getIsBlitz } from "@/ui/constants";
import Button from "@/ui/design-system/atoms/button";
import TextInput from "@/ui/design-system/atoms/text-input";
import { EndSeasonButton, PlayerCustom, PlayerList, RegisterPointsButton } from "@/ui/features/social";
import { getEntityIdFromKeys, normalizeDiacriticalMarks } from "@/ui/utils/utils";
import { getGuildFromPlayerAddress, getStructureName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery } from "@dojoengine/recs";
import { Search } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useState } from "react";

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
  const seasonWinner = useUIStore((state) => state.seasonWinner);

  const isSeasonOver = Boolean(seasonWinner);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchTerm(inputValue);
    }, 300); // 300ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue]);

  const playersWithStructures: PlayerCustom[] = useMemo(() => {
    // Sort players by points in descending order
    const sortedPlayers = [...players].sort((a, b) => (b.points || 0) - (a.points || 0));

    const playersWithStructures = sortedPlayers.map((player, index) => {
      const structuresEntityIds = runQuery([HasValue(Structure, { owner: ContractAddress(player.address) })]);
      const structures = Array.from(structuresEntityIds)
        .map((entityId) => {
          const structure = getComponentValue(Structure, entityId);
          if (!structure) return undefined;

          return getStructureName(structure, getIsBlitz()).name;
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
  }, [isLoading, players, components, account.address]);

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
        {!isSeasonOver ? (
          <>
            {/* <div className="my-2 py-2 px-3 border-2 border-gold-600/70 rounded-lg bg-slate-900/70 shadow-lg shadow-gold-500/20 text-center">
              <p className="font-serif text-lg text-amber-400 animate-pulse tracking-wider leading-relaxed uppercase">
                should any lord gather 9.6m points, they gain the ultimate power to <br /> end this game
              </p>
            </div> */}
            <div className="flex gap-2 justify-center">
              <RegisterPointsButton className="flex-1" />
              {!getIsBlitz() && <EndSeasonButton className="flex-1" />}
            </div>
          </>
        ) : (
          <>
            <div className="my-2 py-2 px-3 border-2 border-gold-600/70 rounded-lg bg-slate-900/70 shadow-lg shadow-gold-500/20 text-center">
              <p className="font-serif text-lg text-amber-400 animate-pulse tracking-wider leading-relaxed uppercase">
                the season is over. {seasonWinner?.name} and the {seasonWinner?.guildName} tribe have conquered eternum
              </p>
            </div>
            <div className="flex justify-center">
              <RegisterPointsButton />
            </div>
          </>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <PlayerList
          players={filteredPlayers}
          viewPlayerInfo={viewPlayerInfo}
          whitelistPlayer={whitelistPlayer}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
