import { useMemo, useState } from "react";
import LordsIcon from "@/components/icons/lords.svg?react";
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
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatLockEndTime } from "@/utils/time";
import { formatNumber } from "@/utils/utils";
import { Check, Unlock } from "lucide-react";
import { formatEther } from "viem";

interface LockInfo {
  amount: bigint;
  end: number;
}
const MAX_LOCK_DURATION = 4 * 365 * 24 * 60 * 60; // 4 years in seconds
const SCALE = 10000n;
const MAX_PENALTY_RATIO = 7500n; // 75%

export function UnlockDialog({
  ownerLordsLock,
  withdraw,
}: {
  ownerLordsLock?: {
    amount: number | bigint;
    end_time: number | bigint;
  };
  lordsBalance?: number | bigint;
  withdraw: () => Promise<{ transaction_hash: string }>;
}) {
  const [open, setOpen] = useState(false);

  const penalty = useMemo(() => {
    if (ownerLordsLock) {
      const lockInfo: LockInfo = {
        amount: BigInt(ownerLordsLock.amount),
        end: Number(ownerLordsLock.end_time),
      };
      return calculatePenalty(lockInfo);
    }
    return 0n;
  }, [ownerLordsLock]);

  function calculatePenalty(lockInfo: LockInfo): bigint {
    if (lockInfo.amount === 0n) return 0n;

    const currentTime = Math.floor(Date.now() / 1000);
    if (lockInfo.end > currentTime) {
      const timeLeft = BigInt(
        Math.min(lockInfo.end - currentTime, MAX_LOCK_DURATION),
      );
      const penaltyRatio = BigInt(
        Math.min(
          Number((timeLeft * SCALE) / BigInt(MAX_LOCK_DURATION)),
          Number(MAX_PENALTY_RATIO),
        ),
      );
      return (lockInfo.amount * penaltyRatio) / SCALE;
    }
    return 0n;
  }

  async function handleWithdraw() {
    const hash = await withdraw();
    toast({
      description: (
        <div className="flex items-center gap-2">
          <Check /> Lords Withdrawal successful {hash.transaction_hash}
        </div>
      ),
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Unlock className="h-4 w-4" />
          Early Unlock
        </Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent>
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <Unlock className="h-6 w-6" />
            Early Withdrawal
          </DialogTitle>
          <div>
            <Label>Current Lock</Label>
            <div className="my-4 flex gap-4">
              <Card>
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">Locked Lords</CardTitle>
                </CardHeader>
                <CardContent>
                  {ownerLordsLock?.amount ? (
                    <div className="flex items-center gap-2">
                      <LordsIcon className="h-4 w-4" />{" "}
                      {formatNumber(
                        Number(formatEther(BigInt(ownerLordsLock.amount))),
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
          <div className="mb-4 flex flex-col gap-4">
            <p className="">
              Pay a penalty determined by lock duration to withdraw your locked
              Lords early
            </p>
            <div className="flex">
              <Card className="w-auto">
                <CardHeader className="p-3">
                  <CardTitle className="text-sm">
                    After Withdrawal Penalty
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {ownerLordsLock?.amount ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <LordsIcon className="h-4 w-4" />
                        {formatNumber(
                          Number(
                            formatEther(
                              BigInt(ownerLordsLock.amount) - BigInt(penalty),
                            ),
                          ),
                        )}
                      </div>
                      <div className="text-xs text-red-300/60">
                        Penalty: {formatEther(BigInt(penalty))} LORDS (
                        {(
                          (Number(penalty) / Number(ownerLordsLock.amount)) *
                          100
                        ).toFixed(2)}
                        %)
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => handleWithdraw()} className="w-full">
              Withdraw Lords
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
