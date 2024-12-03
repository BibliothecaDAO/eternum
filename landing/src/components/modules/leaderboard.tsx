import { getGuilds } from "@/hooks/get-guilds";
import { useGetAllPlayers } from "@/hooks/use-get-all-players";
import { Trophy } from "lucide-react";
import { useMemo } from "react";
import { TypeH2 } from "../typography/type-h2";
import { Card, CardHeader } from "../ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { GuildLeaderboardPanel } from "./guild-leaderboard-panel";
import { PlayerLeaderboardPanel } from "./player-leaderboard-panel";

export const Leaderboard = () => {
  const getPlayers = useGetAllPlayers();
  const players = useMemo(() => getPlayers().sort((a, b) => b.points - a.points), [getPlayers]);
  const guilds = useMemo(() => getGuilds(players).sort((a, b) => b.points - a.points), [players]);

  return (
    <Card className="w-full">
      <CardHeader>
        <TypeH2 className="flex items-center gap-2 uppercase">
          <span>{<Trophy />}</span>
          {"Leaderboard"}
        </TypeH2>
      </CardHeader>

      <Tabs defaultValue="players" className="w-full">
        <div className="p-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="guilds">Guilds</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="players">
          <PlayerLeaderboardPanel players={players} />
        </TabsContent>
        <TabsContent value="guilds">
          <GuildLeaderboardPanel guilds={guilds} />
        </TabsContent>
      </Tabs>
    </Card>
  );
};
