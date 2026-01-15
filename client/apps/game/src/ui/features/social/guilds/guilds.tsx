import { LORDS_PRIZE_POOL, STRK_PRIZE_POOL } from "@/ui/constants";
import { Button, TextInput } from "@/ui/design-system/atoms";
import { SortInterface } from "@/ui/design-system/atoms/sort-button";
import { CreateGuildButton, GuildListHeader, GuildRow, useSocialStore } from "@/ui/features/social";
import { getRealmCountPerHyperstructure, sortItems } from "@/ui/utils/utils";
import {
  calculateGuildLordsPrize,
  getGuildFromPlayerAddress,
  LeaderboardManager,
  toHexString,
} from "@bibliothecadao/eternum";
import { useDojo, useGuilds, usePlayerWhitelist } from "@bibliothecadao/react";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { ChevronRight, Download } from "lucide-react";
import { useMemo, useState } from "react";

export const Guilds = ({
  viewGuildMembers,
  players,
}: {
  viewGuildMembers: (guildEntityId: ContractAddress) => void;
  players: PlayerInfo[];
}) => {
  const {
    setup: {
      components,
      systemCalls: { create_guild },
    },
    account: { account },
  } = useDojo();

  const guildsViewGuildInvites = useSocialStore((state) => state.guildsViewGuildInvites);
  const guildsGuildSearchTerm = useSocialStore((state) => state.guildsGuildSearchTerm);
  const guildsActiveSort = useSocialStore((state) => state.guildsActiveSort);
  const setGuildsViewGuildInvites = useSocialStore((state) => state.setGuildsViewGuildInvites);
  const setGuildsGuildSearchTerm = useSocialStore((state) => state.setGuildsGuildSearchTerm);
  const setGuildsActiveSort = useSocialStore((state) => state.setGuildsActiveSort);

  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [guildName, setGuildName] = useState("");
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "rank",
    sort: "asc",
  });

  const guilds = useGuilds();
  const guildInvites = usePlayerWhitelist(ContractAddress(account.address));
  const playerGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(account.address), components),
    [account.address, components, isLoading],
  );

  // Aggregate player data per guild
  const guildsWithStats = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());

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

        // Calculate real-time total points including unregistered shareholder points
        const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(player.address);
        const unregisteredShareholderPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
          player.address,
        );
        const totalPlayerPoints = registeredPoints + unregisteredShareholderPoints;

        stats.totalPoints += totalPlayerPoints;
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
          prize: calculateGuildLordsPrize(rank, LORDS_PRIZE_POOL, STRK_PRIZE_POOL),
        };
      });
  }, [guilds, players, components]);

  const filteredGuilds = useMemo(
    () =>
      sortItems(
        guildsWithStats.filter((guild) => {
          const nameMatch = guild.name.toLowerCase().startsWith(guildsGuildSearchTerm.toLowerCase());
          if (guildsViewGuildInvites) {
            return (
              nameMatch &&
              guildInvites.some((invite) => {
                return invite.guildEntityId === Number(guild.entityId);
              })
            );
          }
          return nameMatch;
        }),
        guildsActiveSort,
        { sortKey: "rank", sort: "asc" },
      ),
    [guildsWithStats, guildsGuildSearchTerm, guildInvites, guildsViewGuildInvites, guildsActiveSort],
  );

  const generateSocialData = () => {
    const leaderboardManager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());

    const socialData = {
      timestamp: new Date().toISOString(),
      gameInfo: {
        totalPlayers: players.length,
        totalTribes: guilds.length,
      },
      tribes: guildsWithStats.map((guild) => {
        // For each guild, we need to get the members from the existing player data
        // since we can't call hooks inside this function
        const guildPlayers = players.filter((player) => {
          const playerGuild = getGuildFromPlayerAddress(player.address, components);
          return playerGuild?.entityId === guild.entityId;
        });

        // Find tribe owner - the owner's address matches the guild's entityId
        const owner = guildPlayers.find((player) => player.address === guild.entityId);

        // Calculate total tribe points for prize distribution
        const totalTribePoints = guildPlayers.reduce((sum, player) => {
          const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(player.address);
          const unregisteredShareholderPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
            player.address,
          );
          return sum + registeredPoints + unregisteredShareholderPoints;
        }, 0);

        // Get detailed member info with points and prize calculations
        const membersWithPoints = guildPlayers.map((player) => {
          const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(player.address);
          const unregisteredShareholderPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
            player.address,
          );
          const totalPoints = registeredPoints + unregisteredShareholderPoints;

          // Calculate prize distribution
          const isOwner = player.address === guild.entityId;
          const pointsShare = totalTribePoints > 0 ? totalPoints / totalTribePoints : 0;

          // Owner gets 30% + their share of the remaining 70%
          // Non-owners get their share of the 70%
          const ownerBonus = isOwner ? 0.3 : 0;
          const memberShare = pointsShare * 0.7;
          const totalShare = ownerBonus + memberShare;

          const lordsReward = guild.prize.lords * totalShare;
          const strkReward = guild.prize.strk * totalShare;

          return {
            address: toHexString(player.address),
            name: player.name,
            isOwner: isOwner,
            points: totalPoints,
            pointsShare: pointsShare,
            realms: player.realms || 0,
            mines: player.mines || 0,
            hyperstructures: player.hyperstructures || 0,
            villages: player.villages || 0,
            banks: player.banks || 0,
            totalLordsReward: lordsReward,
            totalStrkReward: strkReward,
            rewards: {
              lords: lordsReward,
              strk: strkReward,
              ownerBonus: isOwner ? guild.prize.lords * 0.3 : 0,
              ownerBonusStrk: isOwner ? guild.prize.strk * 0.3 : 0,
              memberShare: guild.prize.lords * memberShare,
              memberShareStrk: guild.prize.strk * memberShare,
            },
          };
        });

        return {
          entityId: toHexString(guild.entityId),
          name: guild.name,
          rank: guild.rank,
          isPublic: guild.isPublic,
          totalPoints: guild.points,
          totalRealms: guild.realms,
          totalMines: guild.mines,
          totalHyperstructures: guild.hyperstructures,
          memberCount: guild.memberCount,
          prize: guild.prize,
          owner: {
            address: owner ? toHexString(owner.address) : null,
            name: owner?.name || "Unknown",
          },
          members: membersWithPoints,
        };
      }),
      players: players.map((player) => {
        const guild = getGuildFromPlayerAddress(player.address, components);
        const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(player.address);
        const unregisteredShareholderPoints = leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(
          player.address,
        );
        const totalPoints = registeredPoints + unregisteredShareholderPoints;

        return {
          address: toHexString(player.address),
          name: player.name,
          rank: player.rank,
          points: totalPoints,
          realms: player.realms || 0,
          mines: player.mines || 0,
          hyperstructures: player.hyperstructures || 0,
          villages: player.villages || 0,
          banks: player.banks || 0,
          isAlive: player.isAlive,
          tribeName: guild?.name || null,
          tribeEntityId: guild ? toHexString(guild.entityId) : null,
        };
      }),
    };

    return socialData;
  };

  const downloadSocialData = () => {
    const socialData = generateSocialData();
    const blob = new Blob([JSON.stringify(socialData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eternum-social-data-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCreateGuild = async (guildName: string, isPublic: boolean) => {
    setIsLoading(true);
    try {
      await create_guild({
        is_public: isPublic,
        guild_name: guildName,
        signer: account,
      });
      // Assuming synchronous success or if create_guild doesn't throw,
      // optimistically update UI.
      setIsCreatingGuild(false); // Close the form
      setGuildName(""); // Reset form state
      setIsPublic(true); // Reset form state
    } catch (error) {
      console.error("Failed to create guild:", error);
      // On error, form remains open, isLoading will become false.
    } finally {
      setIsLoading(false);
    }
  };

  const toggleIsCreatingGuild = () => {
    const willBeCreating = !isCreatingGuild;
    setIsCreatingGuild(willBeCreating);
    if (willBeCreating) {
      // If opening the form
      setGuildName("");
      setIsPublic(true);
    }
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-4 overflow-hidden">
      <div className="flex flex-col space-y-4 mb-4">
        <div className="flex flex-row gap-4 justify-between">
          <div className="flex gap-2">
            <Button onClick={() => setGuildsViewGuildInvites(!guildsViewGuildInvites)}>
              {guildsViewGuildInvites ? "Show Tribe Rankings" : "Show Tribe Invites"}
            </Button>
            <Button
              variant="outline"
              onClick={downloadSocialData}
              className="flex items-center gap-2"
              title="Download social data as JSON"
            >
              <Download className="w-4 h-4" />
              Export Data
            </Button>
          </div>
          {playerGuild?.entityId ? (
            <Button variant="gold" onClick={() => viewGuildMembers(playerGuild.entityId)}>
              Tribe {playerGuild.name}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button isLoading={isLoading} variant="primary" className="w-full" onClick={toggleIsCreatingGuild}>
              Create Tribe
            </Button>
          )}
        </div>

        {!playerGuild?.entityId && isCreatingGuild && (
          <CreateGuildButton
            handleCreateGuild={handleCreateGuild}
            guildName={guildName}
            setGuildName={setGuildName}
            isPublic={isPublic}
            setIsPublic={setIsPublic}
          />
        )}
        <TextInput
          placeholder="Search Tribe . . ."
          value={guildsGuildSearchTerm}
          onChange={(searchTerm) => setGuildsGuildSearchTerm(searchTerm)}
          className="w-full button-wood"
        />
      </div>

      <div className="flex-1 min-h-0">
        <div className="flex flex-col h-full rounded-xl backdrop-blur-sm">
          <GuildListHeader activeSort={guildsActiveSort} setActiveSort={setGuildsActiveSort} />
          <div className="mt-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
            {filteredGuilds.map((guild) => (
              <GuildRow key={guild.entityId} guild={guild} onClick={() => viewGuildMembers(guild.entityId)} />
            ))}
            {!filteredGuilds.length && guildsViewGuildInvites && (
              <p className="text-center italic text-gold/70 py-4">No Tribe Invites Received</p>
            )}
            {!filteredGuilds.length && !guildsViewGuildInvites && guildsGuildSearchTerm && (
              <p className="text-center italic text-gold/70 py-4">No Tribes Found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
