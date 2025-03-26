import { getBlockTimestamp } from "@/shared/lib/hooks/use-block-timestamp";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader } from "@/shared/ui/card";
import {
  configManager,
  ContractAddress,
  divideByPrecision,
  getBalance,
  getEntityIdFromKeys,
  getLevelName,
  getRealmInfo,
} from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ArrowRight, Castle, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { UpgradeDrawer } from "./upgrade-drawer";

interface UpgradeCastleProps {
  realmEntityId: number;
}

export const UpgradeCastle = ({ realmEntityId }: UpgradeCastleProps) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dojo = useDojo();
  const currentDefaultTick = getBlockTimestamp().currentDefaultTick;

  const realmInfo = useMemo(
    () => getRealmInfo(getEntityIdFromKeys([BigInt(realmEntityId)]), dojo.setup.components),
    [realmEntityId, dojo.setup.components],
  );

  const getNextRealmLevel = useMemo(() => {
    if (!realmInfo) return null;
    const nextLevel = realmInfo.level + 1;
    return nextLevel <= configManager.getMaxLevel(realmInfo.category) ? nextLevel : null;
  }, [realmInfo]);

  const { checkUpgradeRequirements, resourceProgress } = useMemo(() => {
    if (!realmInfo || !getNextRealmLevel) return { checkUpgradeRequirements: false, resourceProgress: 0 };

    const costs = configManager.realmUpgradeCosts[getNextRealmLevel] || [];
    let totalProgress = 0;

    const hasRequirements = costs.every((cost) => {
      const balance = getBalance(realmEntityId, cost.resource, currentDefaultTick, dojo.setup.components);
      const currentAmount = divideByPrecision(balance.balance);
      const progress = Math.min(100, (currentAmount * 100) / cost.amount);
      totalProgress += progress;
      return currentAmount >= cost.amount;
    });

    const averageProgress = costs.length > 0 ? Math.floor(totalProgress / costs.length) : 0;

    return {
      checkUpgradeRequirements: hasRequirements,
      resourceProgress: averageProgress,
    };
  }, [realmInfo, getNextRealmLevel, realmEntityId, currentDefaultTick, dojo.setup.components]);

  const handleUpgrade = async () => {
    if (!realmInfo) return;

    await dojo.setup.systemCalls.upgrade_realm({
      signer: dojo.account.account,
      realm_entity_id: realmInfo.entityId,
    });
  };

  if (!realmInfo) return null;

  const isOwner = realmInfo.owner === ContractAddress(dojo.account.account.address);
  if (!isOwner) return null;

  const canUpgrade = getNextRealmLevel !== null && checkUpgradeRequirements;

  return (
    <>
      <Card
        className={`relative overflow-hidden ${canUpgrade ? "bg-gradient-to-br from-amber-500/20 via-card/50 to-emerald-500/20 backdrop-blur-sm" : "bg-card"}`}
      >
        {canUpgrade && (
          <>
            <div className="absolute right-0 top-0 h-32 w-32 animate-pulse bg-green-500/50 blur-3xl" />
            <div className="absolute left-0 top-0 h-32 w-32 animate-pulse bg-amber-500/50 blur-3xl" />
          </>
        )}

        <CardHeader className="relative pb-0">
          <div className="flex items-center gap-2">
            {canUpgrade ? (
              <>
                <Sparkles className="h-5 w-5 text-amber-500" />
                <span className="text-sm font-medium uppercase tracking-wider text-amber-500">
                  Castle Upgrade Available
                </span>
              </>
            ) : (
              <>
                <Castle className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Castle Upgrade
                </span>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="relative flex items-center justify-between gap-4 pt-3">
          <div className="flex flex-1 flex-col gap-3">
            <h3 className="flex flex-col text-xl font-bold">
              {getNextRealmLevel !== null ? (
                <>
                  <span className={canUpgrade ? "text-success" : "text-muted-foreground"}>
                    {canUpgrade ? "Ready to Upgrade!" : "Need More Resources"}
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    {canUpgrade ? (
                      <>
                        {getLevelName(realmInfo.level)}
                        <ArrowRight className="h-4 w-4" />
                        {getLevelName(getNextRealmLevel)}
                      </>
                    ) : (
                      <span className="text-muted-foreground text-lg">Progress: {resourceProgress}%</span>
                    )}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{getLevelName(realmInfo.level)} (Max Level)</span>
              )}
            </h3>

            <Button
              onClick={() => setIsDrawerOpen(true)}
              className={
                canUpgrade
                  ? "w-fit bg-gradient-to-r from-amber-500 to-emerald-500 text-white shadow-lg hover:from-amber-600 hover:to-emerald-600"
                  : "w-fit"
              }
              variant={canUpgrade ? "default" : "outline"}
              size="lg"
            >
              <Castle className="mr-2 h-4 w-4" />
              {getNextRealmLevel !== null
                ? canUpgrade
                  ? `Upgrade to Level ${getNextRealmLevel}`
                  : "Show Requirements"
                : "View Castle Details"}
            </Button>
          </div>

          <div className="relative h-28 w-28 shrink-0">
            {canUpgrade && <div className="absolute inset-0 animate-pulse rounded-full bg-success/20 blur-xl" />}
            <img
              src={`/images/castles/castle-${realmInfo.level}.png`}
              alt="Castle"
              className="relative h-full w-full object-contain drop-shadow-xl"
            />
          </div>
        </CardContent>
      </Card>

      <UpgradeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentLevel={realmInfo.level}
        realmEntityId={realmEntityId}
        onUpgrade={handleUpgrade}
      />
    </>
  );
};
