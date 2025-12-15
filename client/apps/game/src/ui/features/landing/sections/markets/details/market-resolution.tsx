import { useCallback, useEffect, useMemo, useState } from "react";

import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { Button } from "@/ui/design-system/atoms";
import { SqlApi } from "@bibliothecadao/torii";
import { getContractByName } from "@dojoengine/core";
import { HStack, VStack } from "@pm/ui";
import { useAccount } from "@starknet-react/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

import { buildWorldProfile, getFactorySqlBaseUrl, patchManifestWithFactory } from "@/runtime/world";
import { Chain, getGameManifest } from "@contracts";
import { env } from "../../../../../../../env";
import { decodePaddedFeltAscii } from "../market-utils";
import { MaybeController } from "../maybe-controller";
import { buildToriiBaseUrl } from "../use-market-servers";
import { usePlayerRanks } from "./use-player-ranks";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const randomTrialId = () =>
  BigInt("0x" + (globalThis.crypto?.randomUUID?.().replace(/-/g, "") || Date.now().toString(16)));

const toAddressHex = (value: any): string | null => {
  try {
    if (value && typeof value === "object" && "low" in value && "high" in value) {
      const low = BigInt((value as any).low);
      const high = BigInt((value as any).high);
      return `0x${((high << 128n) | low).toString(16)}`;
    }
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return null;
  }
};

const derivePlayersFromMarket = (market: MarketClass): string[] => {
  try {
    const valueEq = (market as any).typCategoricalValueEq?.() ?? market.typCategoricalValueEq?.();
    if (!valueEq || !Array.isArray(valueEq)) return [];
    const addresses = valueEq
      .map((entry: any) => toAddressHex(entry))
      .filter((addr): addr is string => Boolean(addr))
      .filter((addr) => addr !== "0x0");
    return Array.from(new Set(addresses));
  } catch {
    return [];
  }
};

const normalizeAddressString = (value: any): string | null => {
  try {
    if (typeof value === "string" && value.startsWith("0x")) return `0x${BigInt(value).toString(16)}`;
    return `0x${BigInt(value).toString(16)}`;
  } catch {
    return null;
  }
};

const fetchRegisteredPlayers = async (toriiBaseUrl: string, limit: number): Promise<string[]> => {
  const client = new SqlApi(`${toriiBaseUrl}/sql`);
  const rows = await client.fetchRegisteredPlayerPoints(limit, 0);
  return rows
    .map((row: any) => normalizeAddressString(row.playerAddress ?? row.player_address ?? row.address))
    .filter((addr): addr is string => Boolean(addr));
};

const normalizeHex = (value: any): string | null => {
  try {
    const hex = typeof value === "string" ? value : `0x${BigInt(value).toString(16)}`;
    const normalized = hex.startsWith("0x") ? hex.toLowerCase() : `0x${hex.toLowerCase()}`;
    return normalized;
  } catch {
    return null;
  }
};

const extractPrizeDistributionAddress = (market: MarketClass): string | null => {
  const params: any[] = (market as any).oracle_params || [];
  if (!params || params.length < 2) return null;
  return normalizeHex(params[1]);
};

export const MarketResolution = ({ market }: { market: MarketClass }) => {
  const {
    config: { manifest },
  } = useDojoSdk();
  const { account } = useAccount();
  const [isResolving, setIsResolving] = useState(false);
  const [isComputingScores, setIsComputingScores] = useState(false);
  const [computeStatus, setComputeStatus] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [hasFinalRanking, setHasFinalRanking] = useState(false);
  const isSubmittingTx = isResolving || isComputingScores;
  const [serverName, setServerName] = useState<string | null>(null);
  const [serverLookupStatus, setServerLookupStatus] = useState<"pending" | "done">("pending");
  const toriiBaseUrl = useMemo(() => (serverName ? buildToriiBaseUrl(serverName) : null), [serverName]);

  // Use uint256 for market id as calldata
  const marketId_u256 = useMemo(() => uint256.bnToUint256(BigInt(market.market_id)), [market.market_id]);
  const prizeContractAddress = useMemo(() => extractPrizeDistributionAddress(market), [market]);
  const marketPlayers = useMemo(() => derivePlayersFromMarket(market), [market]);

  useEffect(() => {
    setServerName(null);
    setServerLookupStatus("pending");
  }, [market.market_id, market.title]);

  useEffect(() => {
    let cancelled = false;
    const resolveServerName = async () => {
      if (serverLookupStatus === "done") return;

      try {
        const chain = env.VITE_PUBLIC_CHAIN as Chain;
        const factorySqlBaseUrl = getFactorySqlBaseUrl(chain);
        const titleFallback = market.title?.replace(/<br\s*\/?>/gi, " ").trim() || "";

        if (!prizeContractAddress || !factorySqlBaseUrl) {
          if (!cancelled) {
            setServerName(titleFallback || null);
            setServerLookupStatus("done");
          }
          return;
        }

        const queryUrl = `${factorySqlBaseUrl}?query=${encodeURIComponent("SELECT name FROM [wf-WorldDeployed] LIMIT 300;")}`;
        const res = await fetch(queryUrl);
        if (!res.ok) throw new Error(`Factory query failed: ${res.statusText}`);
        const rows = (await res.json()) as any[];

        const names = rows
          .map((row) => row?.name || row?.["data.name"] || row?.data?.name)
          .filter(Boolean)
          .map((felt: string) => decodePaddedFeltAscii(String(felt)))
          .filter((name: string, idx: number, arr: string[]) => Boolean(name) && arr.indexOf(name) === idx);

        const chainManifest = getGameManifest(chain);
        const target = prizeContractAddress;
        const limit = 4;
        let index = 0;
        let matched: string | null = null;

        const worker = async () => {
          while (!cancelled && matched === null && index < names.length) {
            const i = index++;
            const name = names[i];
            try {
              const profile = await buildWorldProfile(chain, name);
              const patched = patchManifestWithFactory(
                chainManifest as any,
                profile.worldAddress,
                profile.contractsBySelector,
              );
              const prizeAddress = normalizeHex(
                (patched as any)?.contracts?.find((c: any) => c.tag === "s1_eternum-prize_distribution_systems")
                  ?.address,
              );
              if (prizeAddress && prizeAddress === target) {
                matched = name;
                return;
              }
            } catch (err) {
              console.error("[market-resolution] Failed to inspect world", name, err);
            }
          }
        };

        await Promise.all(Array.from({ length: limit }, () => worker()));

        if (!cancelled) {
          setServerName(matched || titleFallback || null);
        }
      } catch (err) {
        console.error("[market-resolution] Failed to resolve server name from prize contract", err);
      } finally {
        if (!cancelled) setServerLookupStatus("done");
      }
    };

    void resolveServerName();
    return () => {
      cancelled = true;
    };
  }, [market.title, prizeContractAddress, serverLookupStatus]);

  const loadPlayers = useCallback(async (): Promise<string[]> => {
    if (serverLookupStatus !== "done") return [];
    if (hasFinalRanking) {
      // Final rankings already exist; no need to reload registered players for computation.
      setPlayersLoading(false);
      setPlayersError(null);
      setPlayers([]);
      return [];
    }
    if (!serverName) {
      setPlayersError("Could not determine the game name for this market.");
      return [];
    }

    setPlayersLoading(true);
    setPlayersError(null);

    try {
      const toriiBaseUrl = buildToriiBaseUrl(serverName);
      const rankedPlayers = await fetchRegisteredPlayers(toriiBaseUrl, 500);
      if (rankedPlayers.length > 0) {
        setPlayers(rankedPlayers);
        return rankedPlayers;
      }

      setPlayersError("Could not load registered players from Torii.");
      setPlayers([]);
      return [];
    } catch (playerFetchError) {
      console.error("Failed to load registered players", playerFetchError);
      setPlayersError("Could not load registered players from Torii.");
      setPlayers([]);
      return [];
    } finally {
      setPlayersLoading(false);
    }
  }, [hasFinalRanking, serverLookupStatus, serverName]);

  useEffect(() => {
    if (serverLookupStatus === "done") {
      void loadPlayers();
    }
  }, [loadPlayers, serverLookupStatus]);

  const onResolve = async () => {
    if (serverLookupStatus !== "done") {
      toast.error("Resolving game name… please wait.");
      return;
    }
    if (!account) {
      toast.error("Connect a wallet to resolve the market.");
      return;
    }
    const marketAddress = getContractByName(manifest, "pm", "Markets")!.address;

    const resolveCall: Call = {
      contractAddress: marketAddress,
      entrypoint: "resolve",
      calldata: [marketId_u256.low, marketId_u256.high],
    };

    setIsResolving(true);
    try {
      await account.execute([resolveCall]);
      toast.success("Market resolved");
    } catch (error) {
      console.error("Failed to resolve market", error);
      toast.error("Failed to resolve market");
    } finally {
      setIsResolving(false);
    }
  };

  const onComputeScores = async () => {
    if (hasFinalRanking) {
      toast.success("Scores are already computed (PlayersRankFinal exists).");
      return;
    }
    if (!market.isEnded()) {
      toast.error("Scores can only be computed after the game ends.");
      return;
    }
    if (!account) {
      toast.error("Connect a wallet to compute scores.");
      return;
    }
    if (!serverName) {
      toast.error("Could not determine the game name to load players.");
      return;
    }

    setIsComputingScores(true);
    setComputeStatus("Loading players...");

    try {
      const playerAddresses = await loadPlayers();

      if (playerAddresses.length === 0) {
        toast.error("No registered players found for this game.");
        setComputeStatus(null);
        return;
      }

      setComputeStatus("Resolving prize distribution contract...");
      const chain = env.VITE_PUBLIC_CHAIN as Chain;
      const profile = await buildWorldProfile(chain, serverName);
      const baseManifest = getGameManifest(chain);
      const patchedManifest = patchManifestWithFactory(
        baseManifest as any,
        profile.worldAddress,
        profile.contractsBySelector,
      );
      const prizeContract = getContractByName(patchedManifest as any, "s1_eternum", "prize_distribution_systems");
      if (!prizeContract?.address) {
        toast.error("Prize distribution contract not found for this world.");
        setComputeStatus(null);
        return;
      }

      if (playerAddresses.length === 1) {
        const solePlayer = playerAddresses[0];
        if (!solePlayer) {
          toast.error("Could not determine the registered player address.");
          setComputeStatus(null);
          return;
        }
        setComputeStatus("Submitting single-player claim...");
        const claimCall: Call = {
          contractAddress: prizeContract.address,
          entrypoint: "blitz_prize_claim_no_game",
          calldata: [solePlayer],
        };
        await account.execute([claimCall]);
        setComputeStatus("Single-player claim submitted.");
        toast.success("Single registered player — prize claim submitted.");
        return;
      }

      const total = playerAddresses.length;

      const batches = chunk(playerAddresses, 200);
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        setComputeStatus(`Submitting batch ${i + 1}/${batches.length}...`);
        const rankCall: Call = {
          contractAddress: prizeContract.address,
          entrypoint: "blitz_prize_player_rank",
          calldata: [randomTrialId(), i === 0 ? total : 0, batch.length, ...batch],
        };
        await account.execute([rankCall]);
      }

      setComputeStatus("Score computation submitted.");
      toast.success("Scores computation submitted.");
      refetchRanks();
    } catch (error) {
      console.error("Failed to compute scores", error);
      setComputeStatus("Failed to compute scores.");
      toast.error("Failed to compute scores");
    } finally {
      setIsComputingScores(false);
    }
  };

  const canResolve = market.isResolvable() && !market.isResolved() && serverLookupStatus === "done";
  const hasRankedPlayers = players.length > 0;
  const {
    trialId: finalTrialId,
    ranks: playerRanks,
    isLoading: ranksLoading,
    error: ranksError,
    refetch: refetchRanks,
  } = usePlayerRanks({
    players: marketPlayers.length > 0 ? marketPlayers : players,
    toriiBaseUrl,
  });

  useEffect(() => {
    setHasFinalRanking(Boolean(finalTrialId));
  }, [finalTrialId]);

  useEffect(() => {
    if (finalTrialId) {
      console.debug("[MarketResolution] Final ranking trial id", finalTrialId.toString());
    }
  }, [finalTrialId]);

  const canComputeScores =
    market.isEnded() && hasRankedPlayers && !playersLoading && serverLookupStatus === "done" && !hasFinalRanking;
  const playersLabel = useMemo(() => {
    if (hasFinalRanking) return "Scores already computed — final ranking published.";
    if (serverLookupStatus !== "done") return "Resolving game name...";
    if (playersLoading) return "Loading players...";
    if (players.length === 0 && playersError) return playersError;
    if (players.length === 0) return "No registered players loaded yet.";
    const rankedList = players.map((addr, idx) => `${idx + 1}. ${addr}`).join("\n");
    return `Players (${players.length}) \n${rankedList}`;
  }, [players, playersError, playersLoading, serverLookupStatus]);

  return (
    <>
      <div className="mt-1 text-sm text-gold/70">
        Trigger resolution once the oracle data is ready.{" "}
        {serverLookupStatus !== "done" ? "Resolving game name..." : ""}
      </div>

      <VStack className="mt-4 items-start gap-3">
        <HStack className="flex-wrap gap-3">
          <Button onClick={onResolve} disabled={!canResolve || isSubmittingTx}>
            <span className="flex items-center gap-2">
              {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isResolving ? "Submitting..." : "Resolve Market"}
            </span>
          </Button>
          <Button variant="outline" onClick={onComputeScores} disabled={!canComputeScores || isSubmittingTx}>
            {hasFinalRanking ? (
              "Scores Finalized"
            ) : (
              <span className="flex items-center gap-2">
                {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isComputingScores ? "Submitting..." : "Compute Scores"}
              </span>
            )}
          </Button>
          {!canResolve && <span className="text-xs text-gold/60">Resolution opens after the resolve time.</span>}
          {!canComputeScores && (
            <span className="text-xs text-gold/60">
              {hasFinalRanking
                ? "Scores already computed — see ranking below."
                : playersLoading
                  ? "Loading players..."
                  : !hasRankedPlayers
                    ? "Registered players list unavailable — required to compute scores."
                    : "Score computation opens after the game ends."}
            </span>
          )}
        </HStack>
        {computeStatus && (
          <div className="flex items-center gap-2 text-xs text-gold/70">
            {isSubmittingTx ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            <span>{computeStatus}</span>
          </div>
        )}
        {hasFinalRanking ? (
          <div className="w-full rounded-md border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between text-sm text-gold/80">
              <span className="text-white font-semibold">Final ranking</span>
            </div>
            {ranksLoading ? <p className="mt-2 text-xs text-gold/60">Loading ranking...</p> : null}
            {ranksError ? <p className="mt-2 text-xs text-danger">{ranksError}</p> : null}
            {!ranksLoading && !ranksError ? (
              playerRanks.length > 0 ? (
                <ol className="mt-3 space-y-2 text-sm text-white">
                  {playerRanks.map((entry) => (
                    <li
                      key={`${entry.player}-${entry.rank}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-white/5 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-white/10 px-2 py-[2px] text-[11px] font-semibold uppercase text-gold/70">
                          #{entry.rank}
                        </span>
                        <MaybeController address={entry.player} className="text-white" />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-xs text-gold/60">
                  Ranking finalized, but no players from this market were found in the list.
                </p>
              )
            ) : null}
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words text-[11px] text-gold/60">{playersLabel}</div>
        )}
      </VStack>
    </>
  );
};
