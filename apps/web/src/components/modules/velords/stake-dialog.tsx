import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { getTimeUntil, toWeeks, WEEK_IN_SECONDS } from "@/utils/time";
import { formatNumber, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { formatDistanceToNow, getUnixTime } from "date-fns";
import { Check, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import LordsIcon from "@/components/icons/lords.svg?react";
import { formatEther, parseEther } from "viem";
import type { Address} from "@starknet-react/core";
import { useAccount, useContract } from "@starknet-react/core";
import { L2_C1ERC20 } from "@/abi/L2/C1ERC20";
import { LORDS, StakingAddresses } from "@realms-world/constants";
import type { Call } from "starknet";
import { VeLords } from "@/abi/L2/VeLords";
import { toast } from "@/hooks/use-toast";

function formatLockEndTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return `${date.toLocaleDateString()} (${formatDistanceToNow(date, { addSuffix: true })})`;
}

export function StakeDialog({
  ownerLordsLock,
  lordsBalance,
  manageLordsLock,
}: {
  ownerLordsLock:
    | {
        amount: number | bigint;
        end_time: number | bigint;
      }
    | undefined;
  lordsBalance?: number | bigint;
  manageLordsLock: (args?: Call[]) => Promise<{ transaction_hash: string }>;
}) {
  const { address } = useAccount();
  const [open, setOpen] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("");
  const veLordsAddress = StakingAddresses.velords[SUPPORTED_L2_CHAIN_ID];
  const { contract: veLords } = useContract({
    abi: VeLords,
    address: veLordsAddress as Address,
  });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStakeAmount(value);
  };
  const { contract: lordsContract } = useContract({
    abi: L2_C1ERC20,
    address: LORDS[SUPPORTED_L2_CHAIN_ID]?.address as `0x${string}`,
  });

  const [lockWeeks, setLockWeeks] = useState<number>(0);
  const maxLockWeeks = 4 * 52; // 4 years in weeks

  const timeUntilUnlock = ownerLordsLock?.end_time
    ? getTimeUntil(Number(ownerLordsLock.end_time))
    : undefined;
  const weeksToUnlock = toWeeks(timeUntilUnlock);

  const newLockEndTime = useMemo(() => {
    const currentTime = getUnixTime(new Date());
    const additionalLockTime = lockWeeks * WEEK_IN_SECONDS;
    if (ownerLordsLock?.end_time) {
      return (
        Math.max(Number(ownerLordsLock.end_time), currentTime) +
        additionalLockTime
      );
    } else {
      return currentTime + additionalLockTime;
    }
  }, [ownerLordsLock?.end_time, lockWeeks]);

  const manageLock = async () => {
    if (address && lordsContract && veLords) {
      const hash = await manageLordsLock([
        lordsContract.populate("approve", [
          veLordsAddress as `0x${string}`,
          parseEther(stakeAmount),
        ]),
        veLords.populate("manage_lock", [
          parseEther(stakeAmount),
          newLockEndTime,
          address,
        ]),
      ]);

        toast({
          description: (
            <div className="flex items-center gap-2">
              <Check /> Lords Lock Update successful {hash.transaction_hash}
            </div>
          ),
        });
        setOpen(false);
      
    }
  };

  // Helper function to set stakeAmount as a fraction of lordsBalance.
  const setStakeByFraction = (fraction: number) => {
    if (lordsBalance === undefined) return;
    let value: string;
    if (fraction === 1) {
      value = lordsBalance.toString();
    } else if (typeof lordsBalance === "bigint") {
      if (fraction === 0.5) {
        value = (lordsBalance / BigInt(2)).toString();
      } else if (fraction === 0.25) {
        value = (lordsBalance / BigInt(4)).toString();
      } else {
        value = (Number(lordsBalance) * fraction).toString();
      }
    } else {
      value = (Number(lordsBalance) * fraction).toString();
    }
    setStakeAmount(value);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> Stake
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>
          <DialogTitle className="text-xl font-bold mb-4">
            $LORDS Staking
          </DialogTitle>
          <div>
            <Label>Current Lock</Label>
            <div className="flex gap-4 my-4">
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Locked Lords</CardTitle>
                </CardHeader>
                <CardContent>
                  {ownerLordsLock?.amount ? (
                    <div className="flex items-center gap-2">
                      <LordsIcon className="w-4 h-4" />{" "}
                      {formatNumber(
                        Number(formatEther(BigInt(ownerLordsLock.amount)))
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Unlock Date</CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {ownerLordsLock?.end_time
                    ? formatLockEndTime(Number(ownerLordsLock.end_time))
                    : "N/A"}
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col mb-3">
              <div className="flex justify-between">
                <Label className="flex-1">Stake Lords</Label>
                <div className="flex justify-end items-end gap-2">
                  <Button
                    onClick={() => setStakeByFraction(1)}
                    variant={"link"}
                    className="p-1 h-7"
                  >
                    <Wallet className="w-4 mr-1" />
                    {lordsBalance ? formatNumber(Number(lordsBalance)) : "0"}
                  </Button>
                  <Button
                    className="p-1 h-7 rounded"
                    variant="outline"
                    size="sm"
                    onClick={() => setStakeByFraction(1)}
                  >
                    Max
                  </Button>
                  <Button
                    className="p-1 h-7 rounded"
                    variant="outline"
                    size="sm"
                    onClick={() => setStakeByFraction(0.5)}
                  >
                    50%
                  </Button>
                  <Button
                    className="p-1 h-7 rounded"
                    variant="outline"
                    size="sm"
                    onClick={() => setStakeByFraction(0.25)}
                  >
                    25%
                  </Button>
                </div>
              </div>
              <div className="border flex items-center pl-4 mt-2">
                <div className="flex items-center gap-2 uppercase">
                  <LordsIcon className="w-7" />
                  Lords
                </div>
                <Input
                  value={stakeAmount}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  className="border-0 px-4 py-3 h-12 md:text-xl text-right"
                />
              </div>
            </div>
            <Label>Lock Duration (+{lockWeeks} weeks)</Label>
            <Slider
              className="my-2"
              min={0}
              max={maxLockWeeks - weeksToUnlock}
              step={1}
              value={[lockWeeks]}
              onValueChange={(value) => setLockWeeks(value[0] ?? 0)}
            />
            {lockWeeks > 0 ? (
              <p className="text-sm text-muted">
                New lock end:{" "}
                <span className="text-muted-foreground">
                  {formatLockEndTime(newLockEndTime)}
                </span>
              </p>
            ) : (
              <div className="h-5"></div>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={!stakeAmount && !lockWeeks}
              className="w-full"
              onClick={manageLock}
            >
              Stake
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
