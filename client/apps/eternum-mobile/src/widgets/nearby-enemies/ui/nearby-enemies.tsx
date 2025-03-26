import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/shared/ui/card";
import { AlertTriangle, Eye, Swords } from "lucide-react";

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
const generateDummyData = () => {
  const enemiesCount = Math.floor(Math.random() * 10) + 1;
  const distance = Math.floor(Math.random() * 20) + 1;
  return { enemiesCount, distance };
};

// @ts-ignore
export const NearbyEnemies = ({ entityId, onView }: NearbyEnemiesProps) => {
  const { enemiesCount, distance } = generateDummyData();
  const { color, bgColor, icon: Icon } = getDangerLevel(distance);

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
