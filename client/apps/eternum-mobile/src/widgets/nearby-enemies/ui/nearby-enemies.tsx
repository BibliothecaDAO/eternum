import { cn } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardTitle } from "@/shared/ui/card";
import { useDojo } from "@bibliothecadao/react";
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

// Dummy data generator for demo purposes
// const generateDummyData = () => {
//   const enemiesCount = Math.floor(Math.random() * 10) + 1;
//   const distance = Math.floor(Math.random() * 20) + 1;
//   return { enemiesCount, distance };
// };

const queryArmiesInRadius = async (client: ToriiClient, centerX: number, centerY: number, radius: number) => {
  const query: Query = {
    limit: 100, // Adjust based on your needs
    offset: 0,
    entity_models: ["s1_eternum-ExplorerTroops"], // Replace with your actual model name
    dont_include_hashed_keys: false,
    entity_updated_after: 0,
    order_by: [],
    clause: {
      Composite: {
        operator: "And",
        clauses: [
          // X coordinate within range
          {
            Member: {
              model: "s1_eternum-ExplorerTroops",
              member: "coord.x",
              operator: "Gte",
              value: { Primitive: { U32: centerX - radius } },
            },
          },
          {
            Member: {
              model: "s1_eternum-ExplorerTroops",
              member: "coord.x",
              operator: "Lte",
              value: { Primitive: { U32: centerX + radius } },
            },
          },
          // Y coordinate within range
          {
            Member: {
              model: "s1_eternum-ExplorerTroops",
              member: "coord.y",
              operator: "Gte",
              value: { Primitive: { U32: centerY - radius } },
            },
          },
          {
            Member: {
              model: "s1_eternum-ExplorerTroops",
              member: "coord.y",
              operator: "Lte",
              value: { Primitive: { U32: centerY + radius } },
            },
          },
        ],
      },
    },
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
  const distance = 10;

  useEffect(() => {
    const fetchArmies = async () => {
      console.log({ selectedRealm });
      if (!selectedRealm) return;
      console.log({ position: selectedRealm.position });
      const armies = await queryArmiesInRadius(
        toriiClient,
        selectedRealm.position.x,
        selectedRealm.position.y,
        distance,
      );
      console.log({ armies });
      setArmies(armies);
    };
    fetchArmies();
  }, [toriiClient, selectedRealm]);

  // const { enemiesCount, distance } = generateDummyData();
  const { color, bgColor, icon: Icon } = getDangerLevel(distance);

  const enemiesCount = 10;

  return (
    <Card className={cn(bgColor)}>
      <CardContent className="space-y-3 p-4">
        <CardTitle className={cn("text-sm flex w-full items-center gap-2", color)}>
          <Icon className="w-4 h-4" />
          Nearby Armies
        </CardTitle>
        <div className="text-xs space-y-1">
          <div>
            <span className="font-bold">{enemiesCount}</span> enemies around
          </div>
          <div>
            <span className="font-semibold">{distance}</span> Hexes Away
          </div>
        </div>
        <Button variant="secondary" size="sm" className="w-full font-semibold" onClick={onView}>
          View Details
          <Eye className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};
