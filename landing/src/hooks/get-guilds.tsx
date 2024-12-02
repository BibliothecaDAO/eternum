import { PRIZE_POOL_GUILDS } from "@/constants";
import { Guild, Player } from "@/types";
import { calculateLordsShare } from "@/utils/leaderboard";

export const getGuilds = (players: Player[]): Guild[] => {
  const guildMap = new Map<string, Guild>();

  players.forEach((player) => {
    if (!player.guildName) return;

    if (!guildMap.has(player.guildName)) {
      guildMap.set(player.guildName, {
        name: player.guildName,
        points: 0,
        percentage: 0,
        lords: 0,
        realms: 0,
        mines: 0,
        hyperstructures: 0,
        isAlive: true,
        playerCount: 0,
      });
    }

    const guild = guildMap.get(player.guildName);
    if (!guild) return;
    guild.points += player.points;
    guild.realms += player.realms;
    guild.mines += player.mines;
    guild.hyperstructures += player.hyperstructures;
    guild.isAlive = guild.isAlive && player.isAlive;
    guild.playerCount++;
  });

  const totalPoints = Array.from(guildMap.values()).reduce((sum, guild) => sum + guild.points, 0);

  return Array.from(guildMap.values()).map((guild, index) => ({
    ...guild,
    rank: index + 1,
    percentage: (guild.points / totalPoints) * 100,
    lords: calculateLordsShare(guild.points, totalPoints, PRIZE_POOL_GUILDS),
  }));
};
