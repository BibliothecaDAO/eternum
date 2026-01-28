import { useArmiesInRadius } from "@/features/armies";
import { cn } from "@/shared/lib/utils";
import { useStore } from "@/shared/store";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardFooter, CardTitle } from "@/shared/ui/card";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import Eye from "lucide-react/dist/esm/icons/eye";
import Swords from "lucide-react/dist/esm/icons/swords";
import { useMemo } from "react";

interface NearbyEnemiesProps {
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

export const NearbyEnemies = ({ onView }: NearbyEnemiesProps) => {
  const { selectedRealm } = useStore();

  const { armies, count, isLoading } = useArmiesInRadius(selectedRealm ? selectedRealm.position : null, 20);

  const closestEnemy = useMemo(() => {
    return armies.toSorted((a, b) => a.distance - b.distance)[0];
  }, [armies]);
  const { color, bgColor, icon: Icon } = getDangerLevel(closestEnemy ? closestEnemy.distance : 100);

  return (
    <Card className={cn(bgColor, "flex flex-col justify-between")}>
      <CardContent className="space-y-3 p-4">
        <CardTitle className={cn("text-sm flex w-full items-center gap-2", color)}>
          <Icon className="w-4 h-4" />
          Nearby Armies
        </CardTitle>
        <div className="text-xs space-y-1">
          <div>
            {isLoading ? (
              "Loading..."
            ) : (
              <>
                <span className="font-bold">{count}</span> enemies around
              </>
            )}
          </div>
          {closestEnemy && (
            <div>
              <span className="font-semibold">{closestEnemy.distance}</span> Hexes Away
            </div>
          )}
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
