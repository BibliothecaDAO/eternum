import { cn } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/shared/ui/card";
import { useDojo } from "@bibliothecadao/react";
import { AndComposeClause, MemberClause } from "@dojoengine/sdk";
import { Entities, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { AlertTriangle, Eye, Swords } from "lucide-react";
import { useEffect, useState } from "react";

interface NearbyEnemiesProps {
  entityId: number;
  onView: () => void;
}

const getDangerLevel = (distance: number) => {
  if (distance < 6)
    return {
      level: "high",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      icon: AlertTriangle,
    };
  if (distance < 12)
    return {
      level: "medium",
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      icon: Swords,
    };
  return {
    level: "low",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: Eye,
  };
};

const queryArmiesInRadius = async (client: ToriiClient, centerX: number, centerY: number, radius: number) => {
  const query: Query = {
    limit: 100, // Adjust based on your needs
    offset: 0,
    entity_models: ["s1_eternum-ExplorerTroops"], // Replace with your actual model name
    dont_include_hashed_keys: false,
    entity_updated_after: 0,
    order_by: [],
    clause: AndComposeClause([
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Gte", centerX - radius),
      MemberClause("s1_eternum-ExplorerTroops", "coord.x", "Lte", centerX + radius),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Gte", centerY - radius),
      MemberClause("s1_eternum-ExplorerTroops", "coord.y", "Lte", centerY + radius),
    ]).build(),
  };

  const results = await client.getEntities(query);
  return results;
};

// @ts-ignore
export const NearbyEnemies = ({ entityId, onView }: NearbyEnemiesProps) => {
  const {
    network: { toriiClient },
  } = useDojo();
  const [armies, setArmies] = useState<Entities | null>(null);
  const { selectedRealm } = useStore();

  const distance = 20;

  useEffect(() => {
    const fetchArmies = async () => {
      if (!selectedRealm) return;
      const armies = await queryArmiesInRadius(
        toriiClient,
        selectedRealm.position.x,
        selectedRealm.position.y,
        distance,
      );
      setArmies(armies);
    };

    fetchArmies();

    const interval = setInterval(fetchArmies, 180000);

    return () => clearInterval(interval);
  }, [toriiClient, selectedRealm]);

  const { color, bgColor, icon: Icon } = getDangerLevel(distance);

  return (
    <Card className={cn(bgColor, "flex flex-col justify-between")}>
      <CardContent className="space-y-3 p-4">
        <CardTitle className={cn("text-sm flex w-full items-center gap-2", color)}>
          <Icon className="w-4 h-4" />
          Nearby Armies
        </CardTitle>
        <div className="text-xs space-y-1">
          <div>
            <span className="font-bold">{Object.keys(armies || {}).length}</span> enemies around
          </div>
          <div>
            <span className="font-semibold">{distance}</span> Hexes Away
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4">
        <Button variant="secondary" size="sm" className="w-full font-semibold" onClick={onView}>
          View Details
          <Eye className="w-4 h-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
};
