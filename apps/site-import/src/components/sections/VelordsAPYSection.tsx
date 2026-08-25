import { motion } from "framer-motion";
import { useVelords } from "@/hooks/use-velords";
import { StarknetProvider } from "@/hooks/starknet-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Coins, Lock, Calculator } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  calculateVeLordsAmount,
  calculateUserRewards,
  formatUnlockDate,
  getTimeUntilUnlock,
  getBoostMultiplier,
} from "@/lib/velords-utils";

export function VelordsAPYSection() {
  return (
    <StarknetProvider>
      <VelordsAPYSectionContent />
    </StarknetProvider>
  );
}

function VelordsAPYSectionContent() {
  const {
    currentAPY,
    isAPYLoading,

    veSupplyThisWeek,
    tokensThisWeek,

    userBalance,
    userWeeklyRewards,
    userLocked,
    tvl,
    isTVLLoading,
    lordsLocked,
  } = useVelords();

  const [calculatorAmount, setCalculatorAmount] = useState("");
  const [lockDuration, setLockDuration] = useState("52"); // weeks

  // Calculate potential rewards based on input
  const calculatePotentialRewards = () => {
    if (
      !calculatorAmount ||
      !currentAPY ||
      !lockDuration ||
      !veSupplyThisWeek ||
      !tokensThisWeek
    )
      return null;

    const amount = parseFloat(calculatorAmount);
    const weeks = parseInt(lockDuration);

    // Calculate veLORDS amount based on lock duration
    const veAmount = calculateVeLordsAmount(amount, weeks);

    // Calculate weekly rewards
    const weeklyReward = calculateUserRewards(
      veAmount,
      veSupplyThisWeek,
      tokensThisWeek
    );
    const totalRewards = weeklyReward * weeks;

    // Get boost multiplier
    const boostMultiplier = getBoostMultiplier(weeks);

    return {
      veAmount,
      weeklyReward,
      totalRewards,
      apy: currentAPY,
      boostMultiplier,
    };
  };

  const potentialRewards = calculatePotentialRewards();
  const unlockInfo = userLocked
    ? getTimeUntilUnlock(userLocked.unlockTime)
    : null;

  return (
    <motion.section
      className="container mx-auto px-4 py-12 md:py-20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="text-center mb-8">
        <motion.h2
          className="text-3xl md:text-4xl font-bold mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          veLORDS Staking Rewards
        </motion.h2>
        <motion.p
          className="text-lg text-muted-foreground max-w-2xl mx-auto"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Lock your LORDS tokens to earn rewards from the ecosystem
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Current APY Card */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current APY</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isAPYLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <div className="text-2xl font-bold text-primary">
                  {currentAPY ? `${currentAPY.toFixed(2)}%` : "N/A"}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Annual Percentage Yield
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Total Value Locked */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Value Locked
              </CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {tvl ? (
                <div className="text-2xl font-bold">
                  $
                  {tvl.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              ) : isTVLLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className="text-2xl font-bold">N/A</div>
              )}
              <p className="text-xs text-muted-foreground">
                {lordsLocked
                  ? `${lordsLocked.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })} LORDS`
                  : "In veLORDS"}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Weekly Rewards */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Weekly Rewards
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {tokensThisWeek ? (
                <div className="text-2xl font-bold">
                  {tokensThisWeek.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
              ) : (
                <Skeleton className="h-8 w-32" />
              )}
              <p className="text-xs text-muted-foreground">LORDS distributed</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* User Rewards */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Your Weekly Rewards
              </CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {userBalance !== undefined ? (
                <div className="text-2xl font-bold text-primary">
                  {userWeeklyRewards?.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }) || "0"}
                </div>
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">
                  -
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {userBalance ? "LORDS earned per week" : "Connect wallet"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Rewards Calculator */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Rewards Calculator
            </CardTitle>
            <CardDescription>
              Calculate your potential veLORDS rewards based on lock amount and
              duration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">LORDS Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter LORDS amount"
                    value={calculatorAmount}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCalculatorAmount(e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="duration">Lock Duration (weeks)</Label>
                  <Input
                    id="duration"
                    type="number"
                    placeholder="1-208 weeks"
                    value={lockDuration}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLockDuration(e.target.value)
                    }
                    min="1"
                    max="208"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Max lock: 4 years (208 weeks)
                  </p>
                </div>
              </div>

              {potentialRewards && (
                <div className="space-y-3 bg-secondary/20 rounded-lg p-4">
                  <h4 className="font-semibold">Estimated Rewards</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        veLORDS Balance:
                      </span>
                      <span className="font-medium">
                        {potentialRewards.veAmount.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Boost Multiplier:
                      </span>
                      <span className="font-medium">
                        {potentialRewards.boostMultiplier.toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Weekly Rewards:
                      </span>
                      <span className="font-medium">
                        {potentialRewards.weeklyReward.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 }
                        )}{" "}
                        LORDS
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Total Rewards:
                      </span>
                      <span className="font-medium text-primary">
                        {potentialRewards.totalRewards.toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 }
                        )}{" "}
                        LORDS
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="text-muted-foreground">
                        Effective APY:
                      </span>
                      <span className="font-medium text-primary">
                        {potentialRewards.apy.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* User's Current Position */}
      {userLocked && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6"
        >
          <Card>
            <CardHeader>
              <CardTitle>Your veLORDS Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Locked LORDS</p>
                  <p className="text-xl font-semibold">
                    {userLocked.amount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    veLORDS Balance
                  </p>
                  <p className="text-xl font-semibold">
                    {userBalance?.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    }) || "0"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unlock Date</p>
                  <p className="text-xl font-semibold">
                    {formatUnlockDate(userLocked.unlockTime)}
                  </p>
                  {unlockInfo && !unlockInfo.isUnlocked && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {unlockInfo.days}d {unlockInfo.hours}h{" "}
                      {unlockInfo.minutes}m remaining
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.section>
  );
}
