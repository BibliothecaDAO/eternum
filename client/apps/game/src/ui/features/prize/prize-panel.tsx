import { NumberInput } from "@/ui/design-system/atoms";
import Button from "@/ui/design-system/atoms/button";
import { displayAddress, getRealmCountPerHyperstructure } from "@/ui/utils/utils";
import { LeaderboardManager, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { AlertTriangle, Clock3, Info, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ClaimBlitzPrizeButton } from "./components/claim-blitz-prize-button";
import { WinnersTable } from "./components/winners-table";

type RegisteredPlayer = { address: bigint; points: bigint };

export const PrizePanel = () => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { blitz_prize_player_rank, uuid },
    },
  } = useDojo();

  // Global final trial (if any)
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const final = useMemo(
    () => (finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined),
    [finalEntities],
  );

  console.log({final, finalEntities})
  const finalTrialId = final?.trial_id as bigint | undefined;

  // All trials to find the one owned by the connected user
  const trialEntities = useEntityQuery([Has(components.PlayersRankTrial)]);
  const trials = useMemo(
    () =>
      trialEntities
        .map((eid) => getComponentValue(components.PlayersRankTrial, eid))
        .filter((trial): trial is NonNullable<typeof trial> => Boolean(trial)),
    [trialEntities, components.PlayersRankTrial],
  );
  const myTrial = useMemo(() => {
    const mine = trials.filter(
      (t) => String(t.owner).toLowerCase() === String(account.address).toLowerCase(),
    );
    if (mine.length === 0) return undefined;
    // pick the latest by trial_id
    return mine.sort((a, b) => ((b.trial_id as bigint) > (a.trial_id as bigint) ? 1 : -1))[0];
  }, [trials, account.address]);
  const finalTrial = useMemo(() => {
    if (!finalTrialId) return undefined;
    return trials.find((t) => (t.trial_id as bigint) === finalTrialId);
  }, [trials, finalTrialId]);

  // Build list of registered players ordered by registered_points desc
  const registeredPlayersEntities = useEntityQuery([Has(components.PlayerRegisteredPoints)]);
  const registeredPlayers = useMemo<RegisteredPlayer[]>(() => {
    return registeredPlayersEntities
      .map((eid) => getComponentValue(components.PlayerRegisteredPoints, eid))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .filter((p) => (p.registered_points as bigint) > 0n)
      .map((p) => ({ address: p!.address as unknown as bigint, points: p!.registered_points as bigint }))
      .sort((a, b) => (a.points === b.points ? 0 : a.points < b.points ? 1 : -1));
  }, [registeredPlayersEntities, components.PlayerRegisteredPoints]);

  const worldCfgEntities = useEntityQuery([Has(components.WorldConfig)]);
  const worldCfg = useMemo(
    () => (worldCfgEntities[0] ? getComponentValue(components.WorldConfig, worldCfgEntities[0]) : undefined),
    [worldCfgEntities, components.WorldConfig],
  );

  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 30_000);
    return () => clearInterval(id);
  }, []);

  const toNumber = (value: unknown): number => {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    return 0;
  };

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const prizeTokenDecimals = 18;
  const formatTokenAmount = (amount?: bigint) => {
    if (typeof amount !== "bigint") return "-";
    if (prizeTokenDecimals == null) {
      return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    const d = prizeTokenDecimals;
    const s = amount.toString();
    const pad = d - s.length;
    const whole = pad >= 0 ? "0" : s.slice(0, s.length - d);
    const fracRaw = pad >= 0 ? "0".repeat(pad) + s : s.slice(s.length - d);
    const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const frac = fracRaw.replace(/0+$/, "");
    return frac.length > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
  };

  const seasonConfig = worldCfg?.season_config;
  const seasonTiming = useMemo(() => {
    if (!seasonConfig) return { status: "unknown" as const, endAt: 0, graceEnds: 0 };
    const endAt = toNumber(seasonConfig.end_at);
    const grace = toNumber(seasonConfig.registration_grace_seconds);
    const now = nowTs;
    if (!endAt || now < endAt) {
      return { status: "running" as const, endAt, graceEnds: endAt + grace };
    }
    if (now < endAt + grace) {
      return { status: "grace" as const, endAt, graceEnds: endAt + grace };
    }
    return { status: "ranking-open" as const, endAt, graceEnds: endAt + grace };
  }, [seasonConfig, nowTs]);

  // Defaults
  const [playersPerTx, setPlayersPerTx] = useState<number>(200);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // All players with > 0 points are included automatically

  const hasFinal = Boolean(finalTrialId && (finalTrialId as bigint) > 0n);
  const finalTotalPot = finalTrial ? (finalTrial.total_prize_amount as bigint) : undefined;
  const myTotalPot = myTrial ? (myTrial.total_prize_amount as bigint) : undefined;

  const totalRegistered = registeredPlayers.length;
  const myCommitted = myTrial ? Number(myTrial.total_player_count_committed) : 0;
  const myRevealed = myTrial ? Number(myTrial.total_player_count_revealed) : 0;
  const myRemaining = Math.max(0, myCommitted - myRevealed);
  const myBatchEstimate = playersPerTx > 0 ? Math.ceil(myRemaining / playersPerTx) : 0;
  const rankingCompleted = myCommitted > 0 && myRemaining === 0;

  const rankingWindowOpen = hasFinal || seasonTiming.status === "ranking-open";
  const graceActive = seasonTiming.status === "grace";
  const seasonRunning = seasonTiming.status === "running";
  const statusChipLabel = rankingCompleted
    ? "Complete"
    : seasonTiming.status === "ranking-open"
    ? "Window Open"
    : seasonTiming.status === "grace"
    ? "Grace Window"
    : seasonTiming.status === "running"
    ? "In Season"
    : "Loading";
  const statusChipClass = rankingCompleted || rankingWindowOpen
    ? "border-green-400/40 text-green-300 bg-green-900/20"
    : graceActive
    ? "border-yellow-400/40 text-yellow-200 bg-yellow-900/20"
    : seasonRunning
    ? "border-gray-500/40 text-gray-300 bg-gray-900/30"
    : "border-gray-500/30 text-gray-300 bg-gray-900/20";

  const countdownSeconds = seasonTiming.status === "running"
    ? seasonTiming.endAt - nowTs
    : seasonTiming.status === "grace"
    ? seasonTiming.graceEnds - nowTs
    : 0;
  const countdownText = countdownSeconds > 0 ? formatDuration(countdownSeconds) : null;
  const statusSubtitle = rankingCompleted
    ? "Ranking complete — rewards are ready to claim."
    : rankingWindowOpen
    ? "Finalize the list once to enable prize claims for everyone."
    : graceActive
    ? `Registration closes in ${countdownText ?? "..."}.`
    : seasonRunning
    ? `Season ends in ${countdownText ?? "..."}.`
    : "Checking season status...";
  const statusPrimaryTitle = rankingCompleted
    ? "Ranking finalized"
    : rankingWindowOpen
    ? "Ranking window open"
    : graceActive
    ? "Grace period in progress"
    : seasonRunning
    ? "Season still running"
    : "Season status loading";
  const statusPrimaryBody = rankingCompleted
    ? "Another commander already completed the ranking. Players can claim rewards now."
    : rankingWindowOpen
    ? "Finalize once to unlock prize claims for all ranked players."
    : graceActive
    ? `Points registration closes in ${countdownText ?? "..."}.`
    : seasonRunning
    ? `Finalization unlocks after the season ends${countdownText ? ` (${countdownText})` : ""}.`
    : "Waiting on season data.";

  const handleStartOrContinue = async () => {
    if (registeredPlayers.length === 0) return;
    setIsSubmitting(true);
    setStatus("Preparing…");
    try {
      const manager = LeaderboardManager.instance(components, getRealmCountPerHyperstructure());
      manager.updatePoints();

      // Filter addresses list strictly by registered points ordering
      const addresses = registeredPlayers.map((p) => p.address.toString());

      // Determine trial id and committed count
      const trialId: bigint = myTrial ? (myTrial.trial_id as bigint) : ((await uuid()) as unknown as bigint);
      const committed: number = myTrial ? Number(myTrial.total_player_count_committed) : addresses.length;
      const revealed: number = myTrial ? Number(myTrial.total_player_count_revealed) : 0;

      // Determine which addresses still need to be submitted
      const remaining = addresses.slice(revealed, committed);
      if (remaining.length === 0 && myTrial) {
        setStatus("No remaining players to submit.");
        setIsSubmitting(false);
        return;
      }

      // Chunk and submit
      for (let i = 0; i < remaining.length; i += playersPerTx) {
        const chunk = remaining.slice(i, i + playersPerTx);
        setStatus(`Submitting ${i + 1}-${Math.min(i + playersPerTx, remaining.length)} of ${remaining.length}…`);
        await blitz_prize_player_rank({
          signer: account,
          trial_id: trialId,
          total_player_count_committed: myTrial ? 0 : committed,
          players_list: chunk,
        });
      }
      setStatus("Done");
      toast("Submitted blitz rankings", { description: `Ranking reference ${String(trialId)} updated.` });
    } catch (e: any) {
      console.error(e);
      setStatus("Failed");
      toast("❌ Blitz ranking failed", { description: e?.message || String(e) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasFinal) {
    return (
      <div className="flex flex-col gap-4 h-full">
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-br from-black/70 via-black/50 to-gold/5 p-5 shadow-[0_20px_40px_-20px_rgba(255,215,0,0.35)]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-gold">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/15">
                  <Trophy size={16} />
                </span>
                <div>
                  <span className="text-lg font-semibold tracking-wide uppercase">Blitz Prize</span>
                  <div className="text-xs text-gray-400">Season rewards — final rankings locked in</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Info size={14} /> Prize amounts are displayed using fee token decimals when available.
              </div>
            </div>

            <div className="rounded-xl border border-gold/15 bg-black/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-400 pb-3 border-b border-gold/10 mb-3">
                <span>Ranking Reference</span>
                <div className="flex items-center gap-4 text-gray-300">
                  {/* <span className="font-mono">ID: {String(finalTrialId)}</span> */}
                  <span className="font-mono">Total Pot: {formatTokenAmount(finalTotalPot)}</span>
                </div>
              </div>
              <WinnersTable />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <ClaimBlitzPrizeButton />
              <div className="text-xs text-gray-400">Each ranked player can now claim their reward.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No global final yet: show the active ranking reference
  const myTrialId = myTrial?.trial_id as bigint | undefined;
  const hasMyTrial = Boolean(myTrialId);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="rounded-2xl border border-gold/20 bg-gradient-to-br from-black/70 via-black/55 to-gold/5 p-5 shadow-[0_20px_40px_-20px_rgba(255,215,0,0.35)] h-full flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-gold">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/15">
              <Trophy size={16} />
            </span>
            <div>
              <span className="text-lg font-semibold tracking-wide uppercase">Blitz Prize</span>
              <div className="text-xs text-gray-400">Player rankings determine the prize split</div>
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em] ${statusChipClass}`}>
            {statusChipLabel}
          </div>
        </div>
        <div className="text-xs text-gray-400">{statusSubtitle}</div>

        {hasMyTrial ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold">
                  <Users size={16} />
                </span>
                <div>
                  <div className="text-gray-400">Players Accounted</div>
                  <div className="text-sm text-gray-100 font-medium">{myCommitted}</div>
                </div>
              </div>
              <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold">
                  <Clock3 size={16} />
                </span>
                <div>
                  <div className="text-gray-400">Already Ranked</div>
                  <div className="text-sm text-gray-100 font-medium">{myRevealed}</div>
                </div>
              </div>
              <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-yellow-400/20 text-yellow-300">
                  <AlertTriangle size={16} />
                </span>
                <div>
                  <div className="text-gray-400">Still Pending</div>
                  <div className="text-sm text-gray-100 font-medium">{myRemaining}</div>
                </div>
              </div>
              <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/60">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/20 text-gold">
                  <Trophy size={16} />
                </span>
                <div>
                  <div className="text-gray-400">Reward Pool (raw)</div>
                  <div className="text-sm text-gray-100 font-medium">
                    {(myTrial!.total_prize_amount as bigint).toString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gold/20 bg-black/45 p-4 shadow-inner shadow-black/60">
              <div className="flex items-center justify-between text-xs text-gray-400 pb-3 border-b border-gold/10 mb-3">
                <span>Current Ranking Progress</span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-gray-300">Ref: {String(myTrialId)}</span>
                  <span className="text-gray-300 font-medium">
                    Total Pot: {formatTokenAmount(myTotalPot)}
                  </span>
                </div>
              </div>
              <WinnersTable trialId={myTrialId} />
            </div>

            <div className="rounded-xl border border-gold/15 bg-black/45 p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col gap-1 text-xs text-gray-400">
                  <span className="uppercase tracking-[0.3em] text-[10px] text-gold/70">Next Step</span>
                  <span className="text-sm text-gray-200">Submit the next batch to finish the community ranking.</span>
                </div>
                <div className={`ml-auto px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em] ${statusChipClass}`}>
                  {statusChipLabel}
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
                <Button
                  className="md:flex-1"
                  variant="primary"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || !rankingWindowOpen || rankingCompleted}
                  onClick={handleStartOrContinue}
                >
                  {rankingCompleted ? "Ranking Complete" : "Continue Ranking"}
                </Button>
                <Button className="md:w-auto" variant="outline" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide Advanced" : "Advanced Controls"}
                </Button>
              </div>
              {showAdvanced && (
                <div className="border-t border-gold/10 pt-4 space-y-3 text-xs text-gray-400">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-1">Batch Size</div>
                      <NumberInput value={playersPerTx} onChange={setPlayersPerTx} min={1} max={500} />
                      <div className="text-[11px] text-gray-500 mt-1">Players processed per transaction</div>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-black/30 border border-gold/10">
                      <div>
                        Remaining: {myRemaining} of {myCommitted}
                      </div>
                      <div>Estimated tx: {myBatchEstimate}</div>
                      <div>
                        Next up:{" "}
                        {registeredPlayers
                          .slice(myRevealed, Math.min(myRevealed + 4, myCommitted))
                          .map((p) => displayAddress(toHexString(p.address)))
                          .join(", ") || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {status === "Failed" && (
                <div className="rounded-md bg-red-900/40 border border-red-500/40 text-red-300 p-2 text-xs">
                  Failed to submit
                </div>
              )}
              {status === "Done" && (
                <div className="rounded-md bg-green-900/30 border border-green-500/30 text-green-200 p-2 text-xs">
                  Submitted successfully.
                </div>
              )}
              {status && status !== "Failed" && status !== "Done" && (
                <div className="text-xs text-gray-500">{status}</div>
              )}
            </div>
          </>
        ) : (
          <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/50">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold">
                <Clock3 size={16} />
              </span>
              <div>
                <div className="text-sm text-gray-100 font-medium">{statusPrimaryTitle}</div>
                <div className="text-xs text-gray-400">{statusPrimaryBody}</div>
              </div>
            </div>
            <div className="rounded-xl border border-gold/20 bg-black/45 p-4 flex items-center gap-3 shadow-inner shadow-black/50">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold">
                <Users size={16} />
                </span>
                <div>
                  <div className="text-sm text-gray-100 font-medium">{totalRegistered} players ready</div>
                  <div className="text-xs text-gray-400">
                    Every player with registered points will be included automatically.
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gold/15 bg-black/45 p-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex flex-col gap-1 text-xs text-gray-400">
                  <span className="uppercase tracking-[0.3em] text-[10px] text-gold/70">Preparation</span>
                  <span className="text-sm text-gray-200">
                    One player submits when the window opens. Everyone else just claims.
                  </span>
                </div>
                <div className={`ml-auto px-3 py-1 rounded-full border text-[10px] uppercase tracking-[0.25em] ${statusChipClass}`}>
                  {statusChipLabel}
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3">
              <Button
                className="md:flex-1"
                variant="primary"
                isLoading={isSubmitting}
                disabled={isSubmitting || !rankingWindowOpen || rankingCompleted}
                onClick={handleStartOrContinue}
              >
                {rankingCompleted ? "Ranking Complete" : rankingWindowOpen ? "Start Ranking Submission" : "Ready When Season Ends"}
              </Button>
                <Button className="md:w-auto" variant="outline" onClick={() => setShowAdvanced((v) => !v)}>
                  {showAdvanced ? "Hide Advanced" : "Advanced Controls"}
                </Button>
              </div>
              {showAdvanced && (
                <div className="border-t border-gold/10 pt-4 space-y-3 text-xs text-gray-400">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.3em] text-gold/70 mb-1">Batch Size</div>
                      <NumberInput value={playersPerTx} onChange={setPlayersPerTx} min={1} max={500} />
                      <div className="text-[11px] text-gray-500 mt-1">Players processed per transaction</div>
                    </div>
                    <div className="flex flex-col gap-1 p-3 rounded-lg bg-black/30 border border-gold/10">
                      <div>Commit count: {registeredPlayers.length}</div>
                      <div>Estimated tx: {Math.ceil(registeredPlayers.length / Math.max(1, playersPerTx))}</div>
                      <div>
                        First up:{" "}
                        {registeredPlayers
                          .slice(0, Math.min(5, registeredPlayers.length))
                          .map((p) => displayAddress(toHexString(p.address)))
                          .join(", ") || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {status === "Failed" && (
                <div className="rounded-md bg-red-900/40 border border-red-500/40 text-red-300 p-2 text-xs">
                  Failed to start ranking. Try a smaller batch size or wait until the ranking window opens.
                </div>
              )}
              {status === "Done" && (
                <div className="rounded-md bg-green-900/30 border border-green-500/30 text-green-200 p-2 text-xs">
                  Submitted successfully.
                </div>
              )}
              {status && status !== "Failed" && status !== "Done" && (
                <div className="text-xs text-gray-500">{status}</div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
