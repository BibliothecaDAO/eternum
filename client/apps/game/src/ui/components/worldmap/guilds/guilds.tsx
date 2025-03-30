import { CreateGuildButton } from "@/ui/components/worldmap/guilds/create-guild-button";
import { GuildListHeader, GuildRow } from "@/ui/components/worldmap/guilds/guild-list";
import { PRIZE_POOL_GUILDS } from "@/ui/constants";
import Button from "@/ui/elements/button";
import { SortInterface } from "@/ui/elements/sort-button";
import TextInput from "@/ui/elements/text-input";
import { sortItems } from "@/ui/utils/utils";
import {
  calculateGuildLordsPrize,
  ContractAddress,
  getGuildFromPlayerAddress,
  ID,
  PlayerInfo,
} from "@bibliothecadao/eternum";
import { useDojo, useGuilds, usePlayerWhitelist } from "@bibliothecadao/react";
import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export const Guilds = ({
  viewGuildMembers,
  players,
}: {
  viewGuildMembers: (guildEntityId: ID) => void;
  players: PlayerInfo[];
}) => {
  const {
    setup: {
      components,
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();

  const guilds = useGuilds();
  const guildInvites = usePlayerWhitelist(ContractAddress(account.address));
  const playerGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(account.address), components),
    [account.address, components],
  );

  const showGuildButton = playerGuild?.entityId;

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);
  const [guildSearchTerm, setGuildSearchTerm] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [guildName, setGuildName] = useState("");
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });

  // Aggregate player data per guild
  const guildsWithStats = useMemo(() => {
    const guildStats = new Map<
      string,
      {
        totalPoints: number;
        totalRealms: number;
        totalMines: number;
        totalHypers: number;
        memberCount: number;
      }
    >();

    players.forEach((player) => {
      const guild = getGuildFromPlayerAddress(player.address, components);
      if (guild) {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };

        stats.totalPoints += player.points || 0;
        stats.totalRealms += player.realms || 0;
        stats.totalMines += player.mines || 0;
        stats.totalHypers += player.hyperstructures || 0;
        stats.memberCount++;

        guildStats.set(guild.entityId.toString(), stats);
      }
    });

    return guilds
      .map((guild) => {
        const stats = guildStats.get(guild.entityId.toString()) || {
          totalPoints: 0,
          totalRealms: 0,
          totalMines: 0,
          totalHypers: 0,
          memberCount: 0,
        };
        return {
          ...guild,
          points: stats.totalPoints,
          realms: stats.totalRealms,
          mines: stats.totalMines,
          hyperstructures: stats.totalHypers,
          memberCount: stats.memberCount,
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((guild, index) => {
        const rank = index + 1;
        return {
          ...guild,
          rank,
          lords: calculateGuildLordsPrize(rank, PRIZE_POOL_GUILDS),
        };
      });
  }, [guilds, players]);

  const filteredGuilds = useMemo(
    () =>
      sortItems(
        guildsWithStats.filter((guild) => {
          const nameMatch = guild.name.toLowerCase().startsWith(guildSearchTerm.toLowerCase());
          if (viewGuildInvites) {
            return nameMatch && guildInvites.some((invite) => invite.entityId === guild.entityId);
          }
          return nameMatch;
        }),
        activeSort,
        { sortKey: "rank", sort: "asc" },
      ),
    [guildsWithStats, guildSearchTerm, guildInvites, viewGuildInvites, activeSort],
  );

  const handleCreateGuild = (guildName: string, isPublic: boolean) => {
    setIsLoading(true);
    setIsCreatingGuild(false);
    create_guild({
      is_public: isPublic,
      guild_name: guildName,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const toggleIsCreatingGuild = () => {
    setIsCreatingGuild((prev) => !prev);
    if (!isCreatingGuild) {
      setIsPublic(true);
      setGuildName("");
    } else {
      setGuildSearchTerm("");
    }
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-2 overflow-hidden">
      {showGuildButton ? (
        <Button
          className="text-ellipsis uppercase font-sans !bg-blueish/20 hover:!bg-gold"
          variant="primary"
          onClick={() => viewGuildMembers(playerGuild.entityId)}
        >
          {playerGuild.name}
          <ChevronRight className="w-4 h-4" />
        </Button>
      ) : (
        <Button isLoading={isLoading} variant="primary" onClick={toggleIsCreatingGuild}>
          {isCreatingGuild ? "Search Tribe" : "Create Tribe"}
        </Button>
      )}

      <Button className="my-4" variant="primary" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
        {viewGuildInvites ? "Tribe Rankings" : "Tribe Invites"}
      </Button>

      <div className="mb-4">
        {isCreatingGuild ? (
          <CreateGuildButton
            handleCreateGuild={handleCreateGuild}
            guildName={guildName}
            setGuildName={setGuildName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
          />
        ) : (
          <TextInput
            placeholder="Search Tribe . . ."
            onChange={(guildSearchTerm) => setGuildSearchTerm(guildSearchTerm)}
          />
        )}
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex flex-col h-full p-2 bg-brown-900/50 border border-gold/30 rounded-xl backdrop-blur-sm">
          <GuildListHeader activeSort={activeSort} setActiveSort={setActiveSort} />
          <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {filteredGuilds.map((guild) => (
              <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
            ))}
            {!filteredGuilds.length && viewGuildInvites && (
              <p className="text-center italic">No Tribe Invites Received</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
