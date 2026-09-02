import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { activeGameRows } from "@/sync/recs-rows";
import { NumberInput } from "@/ui/design-system/atoms";
import Button from "@/ui/design-system/atoms/button";
import { displayAddress } from "@/ui/utils/utils";
import { LeaderboardManager, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Users from "lucide-react/dist/esm/icons/users";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { WinnersTable } from "./components/winners-table";

type RankedPlayer = { address: bigint; points: bigint };
type SubmissionState = {
  phase: "idle" | "preparing" | "submitting" | "success" | "error";
  message?: string;
  progress?: { current: number; total: number };
};

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return 0;
};

const formatDuration = (seconds: number): string => {
  if (seconds <= 0) return "0s";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

export const PrizePanel = () => {
  const {
    setup: {
      components,
      systemCalls: { blitz_prize_player_rank, uuid },
    },
  } = useDojo();
  const account = useAccountStore((state) => state.account);
  const mode = useGameModeConfig();
  // The settlement slice is the subscription; the leaderboard revision is the recompute signal for the RECS reads.
  const settledPlayers = useWorldSlicesStore((state) => state.blitzSettlementPlayers);
  const leaderboardRevision = useWorldSlicesStore((state) => state.leaderboardRevision);

  const { game, trial, pointsByPlayer } = useMemo(() => {
    // The revision is the signal, not an input: the registry, trial and registered points are read from RECS here.
    void leaderboardRevision;
    return {
      game: activeGameRows(components.GameRegistry).at(0),
      trial: activeGameRows(components.PlayersRankTrial).at(0),
      pointsByPlayer: new Map<bigint, bigint>(
        activeGameRows(components.PlayerRegisteredPoints).map((row) => [
          row.address as bigint,
          row.registered_points as bigint,
        ]),
      ),
    };
  }, [components, leaderboardRevision]);
  const rankedPlayers = useMemo<RankedPlayer[]>(
    () =>
      settledPlayers
        .map((address) => ({ address, points: pointsByPlayer.get(address) ?? 0n }))
        .toSorted((left, right) => {
          if (left.points !== right.points) return left.points > right.points ? -1 : 1;
          return left.address < right.address ? -1 : 1;
        }),
    [pointsByPlayer, settledPlayers],
  );

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [playersPerTransaction, setPlayersPerTransaction] = useState(200);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submission, setSubmission] = useState<SubmissionState>({ phase: "idle" });

  useEffect(() => {
    const interval = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(interval);
  }, []);

  const finalTrialId = BigInt(game?.final_trial_id ?? 0);
  const finalized = finalTrialId > 0n;
  const endAt = toNumber(game?.end_at);
  const graceEndsAt = endAt + toNumber(game?.registration_grace_seconds);
  const rankingOpen = endAt > 0 && now >= graceEndsAt;
  const committed = Number(trial?.total_player_count_committed ?? 0);
  const revealed = Number(trial?.total_player_count_revealed ?? 0);
  const remaining = Math.max(0, committed - revealed);
  const isSubmitting = submission.phase === "preparing" || submission.phase === "submitting";
  const blockedReason = !account
    ? "Connect your wallet to submit results."
    : finalized
      ? "Results are already finalized."
      : !rankingOpen
        ? `Submission opens when ${mode.labels.timelineSubject.toLowerCase()} and its grace period end.`
        : rankedPlayers.length === 0
          ? "No settled players are available."
          : null;

  const submitResults = async () => {
    if (!account || blockedReason) return;
    setSubmission({ phase: "preparing", message: "Preparing ordered results..." });
    try {
      LeaderboardManager.instance(components).updatePoints();
      const addresses = rankedPlayers.map((player) => player.address.toString());
      const trialId = trial ? (trial.nonce as bigint) : ((await uuid()) as bigint);
      const committedCount = trial ? committed : addresses.length;
      const pending = addresses.slice(trial ? revealed : 0, committedCount);
      const batches = Math.ceil(pending.length / playersPerTransaction);

      for (let offset = 0; offset < pending.length; offset += playersPerTransaction) {
        const batch = pending.slice(offset, offset + playersPerTransaction);
        const batchNumber = Math.floor(offset / playersPerTransaction) + 1;
        setSubmission({
          phase: "submitting",
          message: `Submitting result batch ${batchNumber}/${batches}...`,
          progress: { current: batchNumber, total: batches },
        });
        await blitz_prize_player_rank({
          signer: account,
          trial_id: trialId,
          total_player_count_committed: trial ? 0 : committedCount,
          players_list: batch,
        });
      }

      setSubmission({ phase: "success", message: `Finalized results for ${committedCount} players.` });
      toast.success("Results finalized", {
        description: "The operator can now relay the ordered outcome to the mainnet ledger.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmission({ phase: "error", message });
      toast.error("Result submission failed", { description: message });
    }
  };

  if (finalized) {
    return (
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="rounded-xl border border-gold/15 bg-black/30 p-4">
          <div className="mb-3 border-b border-gold/10 pb-3 text-xs text-gold/70">
            Results are final. Mainnet payouts and MMR are applied by the game operator until proofs ship.
          </div>
          <WinnersTable />
        </div>
      </div>
    );
  }

  const countdown = Math.max(0, graceEndsAt - now);
  const statusTitle = rankingOpen ? "Results window open" : `${mode.labels.timelineSubject} still running`;
  const statusBody = rankingOpen
    ? "One player can submit the complete ordered roster."
    : `Submission opens in ${formatDuration(countdown)}.`;
  const estimatedTransactions = Math.ceil((trial ? remaining : rankedPlayers.length) / playersPerTransaction);

  return (
    <div className="flex h-full flex-col gap-5 p-5">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-xl border border-gold/20 bg-black/30 p-4">
          <Clock3 size={16} className="text-gold" />
          <div>
            <div className="text-sm font-medium text-gold">{statusTitle}</div>
            <div className="text-xs text-gold/70">{statusBody}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-gold/20 bg-black/30 p-4">
          <Users size={16} className="text-gold" />
          <div>
            <div className="text-sm font-medium text-gold">{rankedPlayers.length} players</div>
            <div className="text-xs text-gold/70">The full settled roster is included, including zero-point ties.</div>
          </div>
        </div>
      </div>

      {trial && (
        <div className="rounded-xl border border-gold/20 bg-black/30 p-4">
          <div className="mb-3 text-xs text-gold/70">
            {revealed} of {committed} result rows submitted
          </div>
          <WinnersTable />
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-gold/15 bg-black/30 p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            className="md:flex-1"
            variant="primary"
            isLoading={isSubmitting}
            disabled={isSubmitting || Boolean(blockedReason)}
            onClick={submitResults}
          >
            {trial ? "Continue Result Submission" : "Submit Final Results"}
          </Button>
          <Button className="md:w-auto" variant="outline" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "Hide Advanced" : "Advanced Controls"}
          </Button>
        </div>

        {showAdvanced && (
          <div className="grid gap-3 border-t border-gold/10 pt-4 text-xs text-gold/70 md:grid-cols-2">
            <div>
              <div className="mb-1 text-[11px] uppercase tracking-[0.3em]">Batch Size</div>
              <NumberInput value={playersPerTransaction} onChange={setPlayersPerTransaction} min={1} max={500} />
            </div>
            <div className="rounded-lg border border-gold/15 bg-black/30 p-3">
              <div>Estimated transactions: {estimatedTransactions}</div>
              <div>
                Next:{" "}
                {rankedPlayers
                  .slice(revealed, revealed + 4)
                  .map((player) => displayAddress(toHexString(player.address)))
                  .join(", ") || "-"}
              </div>
            </div>
          </div>
        )}

        {blockedReason && submission.phase === "idle" && (
          <div className="rounded-md border border-gold/30 bg-gold/10 p-2 text-xs text-gold/80">{blockedReason}</div>
        )}
        {submission.phase !== "idle" && (
          <div
            className={`rounded-md border p-2 text-xs ${
              submission.phase === "error"
                ? "border-danger/40 bg-danger/15 text-danger"
                : submission.phase === "success"
                  ? "border-brilliance/40 bg-brilliance/10 text-brilliance"
                  : "border-gold/30 bg-gold/10 text-gold"
            }`}
          >
            {submission.message}
            {submission.progress && ` Batch ${submission.progress.current}/${submission.progress.total}.`}
          </div>
        )}
      </div>
    </div>
  );
};
