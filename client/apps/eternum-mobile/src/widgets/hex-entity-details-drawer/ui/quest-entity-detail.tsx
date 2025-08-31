import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { ResourceIcon } from "@/shared/ui/resource-icon";
import { formatTime, getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";

interface MobileQuestEntityDetailProps {
  questEntityId: ID;
  compact?: boolean;
}

interface QuestTileData {
  game_address: string;
  level: number;
  capacity: number;
  participant_count: number;
  reward_resource_id?: number;
  reward_amount?: number;
}

interface MinigameData {
  name: string;
  contract_address: string;
}

export const QuestEntityDetail = ({ questEntityId, compact = false }: MobileQuestEntityDetailProps) => {
  const {
    setup: { components },
  } = useDojo();

  const [quest, setQuest] = useState<QuestTileData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuest = async () => {
      setIsLoading(true);
      try {
        setQuest({
          game_address: "0x123",
          level: 1,
          capacity: 10,
          participant_count: 3,
          reward_resource_id: 1,
          reward_amount: 100,
        });
      } catch (error) {
        console.error("Failed to fetch quest:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuest();
  }, [questEntityId]);

  const game: MinigameData | undefined = useMemo(
    () => ({
      name: "Treasure Hunt",
      contract_address: quest?.game_address || "",
    }),
    [quest?.game_address],
  );

  const slotsRemaining = useMemo(
    () => (quest?.capacity ?? 0) - (quest?.participant_count ?? 0),
    [quest?.capacity, quest?.participant_count],
  );

  const hasSlotsRemaining = useMemo(() => slotsRemaining > 0, [slotsRemaining]);

  const questLevelsEntity = useMemo(
    () => getComponentValue(components.QuestLevels, getEntityIdFromKeys([BigInt(quest?.game_address || 0)])),
    [components, quest?.game_address],
  );

  const questLevel = questLevelsEntity?.levels[quest?.level ?? 0] as any;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quest) return null;

  return (
    <Card>
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center justify-between">
          <CardTitle className={compact ? "text-base" : "text-lg"}>{game?.name || "Quest"}</CardTitle>
          <Badge variant={hasSlotsRemaining ? "default" : "secondary"}>{hasSlotsRemaining ? "Active" : "Ended"}</Badge>
        </div>
        <div className="text-sm text-muted-foreground">Level {(quest?.level ?? 0) + 1}</div>
      </CardHeader>

      <CardContent className={`space-y-3 ${compact ? "pt-0" : ""}`}>
        <p className="text-sm text-muted-foreground">Interact with an explorer unit to start and claim quests.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded p-2">
            <div className="text-sm font-medium">Reward</div>
            <div className="flex items-center gap-1 mt-1">
              {quest.reward_resource_id && (
                <>
                  <ResourceIcon resourceId={quest.reward_resource_id} size={16} />
                  <span className="text-sm">{quest.reward_amount || 0}</span>
                </>
              )}
            </div>
          </div>

          <div className="bg-muted/50 rounded p-2">
            <div className="text-sm font-medium">Remaining</div>
            <div className="text-sm mt-1">{slotsRemaining} slots</div>
          </div>
        </div>

        {questLevel && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded p-2">
              <div className="text-sm font-medium">Target</div>
              <div className="text-sm mt-1">{questLevel?.value?.target_score?.value || 0}XP</div>
            </div>

            <div className="bg-muted/50 rounded p-2">
              <div className="text-sm font-medium">Time Limit</div>
              <div className="text-sm mt-1">
                {questLevel?.value?.time_limit?.value ? formatTime(questLevel.value.time_limit.value) : "No limit"}
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">Quest ID: #{questEntityId}</div>
      </CardContent>
    </Card>
  );
};
