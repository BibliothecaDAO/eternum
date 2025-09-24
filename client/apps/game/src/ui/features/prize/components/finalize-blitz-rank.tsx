import Button from "@/ui/design-system/atoms/button";
import { getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useState, useMemo } from "react";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

export const FinalizeBlitzRank = ({ className }: { className?: string }) => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { blitz_prize_player_rank, uuid },
    },
  } = useDojo();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const playersList = useMemo(() => {
    const manager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());
    manager.updatePoints();
    return manager.playersByRank
      .filter(([, points]) => points > 0)
      .map(([address]) => address as unknown as string);
  }, [components]);

  const onFinalize = async () => {
    if (playersList.length === 0) return;
    setIsSubmitting(true);
    setStatus("Preparing…");
    try {
      const trialId = (await uuid()) as unknown as bigint;
      const total = playersList.length;
      const batches = chunk(playersList, 200);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setStatus(`Submitting batch ${i + 1}/${batches.length}…`);
        await blitz_prize_player_rank({
          signer: account,
          trial_id: trialId,
          total_player_count_committed: i === 0 ? total : 0,
          players_list: batch,
        });
      }
      setStatus("Done");
    } catch (e) {
      console.error(e);
      setStatus("Failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={className}>
      <div className="text-xs text-gray-400 mb-2">Permissionless — use with caution.</div>
      <Button variant={playersList.length > 0 ? "warning" : "outline"} disabled={playersList.length === 0 || isSubmitting} isLoading={isSubmitting} onClick={onFinalize}>
        Finalize Blitz Rankings
      </Button>
      {status && <div className="text-xs text-gray-500 mt-2">{status}</div>}
    </div>
  );
};

