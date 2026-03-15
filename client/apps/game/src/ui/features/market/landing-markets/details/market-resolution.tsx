import { useCallback, useEffect, useMemo, useState } from "react";

import { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { Button } from "@/ui/design-system/atoms";
import { SqlApi } from "@bibliothecadao/torii";
import { getContractByName } from "@dojoengine/core";
import { HStack, VStack } from "@pm/ui";
import { useAccount } from "@starknet-react/core";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import { toast } from "sonner";
import { Call, uint256 } from "starknet";

import { buildWorldProfile, getFactorySqlBaseUrl, patchManifestWithFactory } from "@/runtime/world";
import { Chain, getGameManifest } from "@contracts";
import { env } from "../../../../../../env";
import { decodePaddedFeltAscii } from "../market-utils";
import { MaybeController } from "../maybe-controller";
import { buildToriiBaseUrl } from "../use-market-servers";
import { usePlayerRanks } from "./use-player-ranks";

const chunk = <T,>(arr: T[], size: number) => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const TX_TIMEOUT_MS = 120_000;
const TX_CONFIRM_TIMEOUT_MS = 25_000;
type BigNumberish = string | number | bigint;
type Uint256Like = { low: BigNumberish; high: BigNumberish };
type RegisteredPlayerRow = { playerAddress?: unknown; player_address?: unknown; address?: unknown };
type FactoryWorldRow = { name?: unknown; data?: { name?: unknown }; "data.name"?: unknown };
type ManifestContractEntry = { tag?: string; address?: unknown };
type ManifestLike = { contracts?: ManifestContractEntry[] };

const hasUint256Shape = (value: unknown): value is Uint256Like =>
  Boolean(
    value &&
    typeof value === "object" &&
    "low" in value &&
    "high" in value &&
    (value as { low?: unknown; high?: unknown }).low !== undefined &&
    (value as { low?: unknown; high?: unknown }).high !== undefined,
  );

const withTxTimeout = async <T,>(promise: Promise<T>, label: string, timeoutMs: number = TX_TIMEOUT_MS): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`${label} is taking too long. Please check your wallet and try again.`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
};

const waitForTxConfirmationIfAvailable = async (
  account: {
    waitForTransaction?: (txHash: string) => Promise<unknown>;
    provider?: {
      waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
      waitForTransaction?: (txHash: string) => Promise<unknown>;
    };
  },
  executeResult: unknown,
  label: string,
): Promise<boolean> => {
  const txHash =
    typeof executeResult === "object" &&
    executeResult !== null &&
    "transaction_hash" in executeResult &&
    typeof (executeResult as { transaction_hash?: unknown }).transaction_hash === "string"
      ? ((executeResult as { transaction_hash: string }).transaction_hash as string)
      : null;

  if (!txHash) {
    return false;
  }

  const providerWithCheck = account.provider;
  const waitWithCheck =
    providerWithCheck && typeof providerWithCheck.waitForTransactionWithCheck === "function"
      ? providerWithCheck.waitForTransactionWithCheck.bind(providerWithCheck)
      : null;
  const waitFromAccount =
    typeof account.waitForTransaction === "function" ? account.waitForTransaction.bind(account) : null;
  const waitFromProvider =
    providerWithCheck && typeof providerWithCheck.waitForTransaction === "function"
      ? providerWithCheck.waitForTransaction.bind(providerWithCheck)
      : null;

  const waitFn = waitWithCheck ?? waitFromAccount ?? waitFromProvider;
  if (!waitFn) {
    return false;
  }
  try {
    await withTxTimeout(waitFn(txHash), `${label} confirmation`, TX_CONFIRM_TIMEOUT_MS);
    return true;
  } catch {
    // Keep UX responsive when providers fail to report confirmation despite successful execution.
    // The tx is already submitted at this point.
    toast.message("Transaction submitted. Confirmation is delayed in wallet RPC; data may update after refresh.");
    return false;
  }
};

const randomTrialId = () =>
  BigInt("0x" + (globalThis.crypto?.randomUUID?.().replace(/-/g, "") || Date.now().toString(16)));

const toAddressHex = (value: unknown): string | null => {
  try {
    if (hasUint256Shape(value)) {
      const low = BigInt(value.low);
      const high = BigInt(value.high);
      return `0x${((high << 128n) | low).toString(16)}`;
    }
    return `0x${BigInt(value as BigNumberish).toString(16)}`;
  } catch {
    return null;
  }
};

const derivePlayersFromMarket = (market: MarketClass): string[] => {
  try {
    const marketWithCategorical = market as MarketClass & { typCategoricalValueEq?: () => unknown };
    const valueEq = marketWithCategorical.typCategoricalValueEq?.();
    if (!valueEq || !Array.isArray(valueEq)) return [];
    const addresses = valueEq
      .map((entry) => toAddressHex(entry))
      .filter((addr): addr is string => Boolean(addr))
      .filter((addr) => addr !== "0x0");
    return Array.from(new Set(addresses));
  } catch {
    return [];
  }
};

const normalizeAddressString = (value: unknown): string | null => {
  try {
    if (typeof value === "string" && value.startsWith("0x")) return `0x${BigInt(value).toString(16)}`;
    return `0x${BigInt(value as BigNumberish).toString(16)}`;
  } catch {
    return null;
  }
};

const fetchRegisteredPlayers = async (toriiBaseUrl: string, limit: number): Promise<string[]> => {
  const client = new SqlApi(`${toriiBaseUrl}/sql`);
  const rows = await client.fetchRegisteredPlayerPoints(limit, 0);
  return (rows as RegisteredPlayerRow[])
    .map((row) => normalizeAddressString(row.playerAddress ?? row.player_address ?? row.address))
    .filter((addr): addr is string => Boolean(addr));
};

const normalizeHex = (value: unknown): string | null => {
  try {
    const hex = typeof value === "string" ? value : `0x${BigInt(value as BigNumberish).toString(16)}`;
    const normalized = hex.startsWith("0x") ? hex.toLowerCase() : `0x${hex.toLowerCase()}`;
    return normalized;
  } catch {
    return null;
  }
};

const extractPrizeDistributionAddress = (market: MarketClass): string | null => {
  const marketWithOracle = market as MarketClass & { oracle_params?: unknown[] };
  const params = Array.isArray(marketWithOracle.oracle_params) ? marketWithOracle.oracle_params : [];
  if (!params || params.length < 2) return null;
  return normalizeHex(params[1]);
};

type TxFeedbackOptions = {
  suppressSuccessToast?: boolean;
  suppressErrorToast?: boolean;
};

type ComputeScoresResult = "already-computed" | "submitted" | "failed" | "skipped";

export interface MarketResolutionController {
  canResolve: boolean;
  canComputeScores: boolean;
  hasFinalRanking: boolean;
  hasRankedPlayers: boolean;
  playersLoading: boolean;
  serverLookupStatus: "pending" | "done";
  isResolving: boolean;
  isComputingScores: boolean;
  isResolvingWithCompute: boolean;
  isSubmittingTx: boolean;
  computeStatus: string | null;
  playersLabel: string;
  playerRanks: Array<{ player: string; rank: number }>;
  ranksLoading: boolean;
  ranksError: string | null;
  onResolve: () => Promise<boolean>;
  onComputeScores: () => Promise<ComputeScoresResult>;
  onResolveWithCompute: () => Promise<boolean>;
}

export const useMarketResolutionController = (market: MarketClass): MarketResolutionController => {
  const {
    config: { manifest },
  } = useDojoSdk();
  const { account } = useAccount();
  const [isResolving, setIsResolving] = useState(false);
  const [isComputingScores, setIsComputingScores] = useState(false);
  const [isResolvingWithCompute, setIsResolvingWithCompute] = useState(false);
  const [computeStatus, setComputeStatus] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [hasFinalRanking, setHasFinalRanking] = useState(false);
  const isSubmittingTx = isResolving || isComputingScores || isResolvingWithCompute;
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
        const rawRows = (await res.json()) as unknown;
        const rows = Array.isArray(rawRows) ? (rawRows as FactoryWorldRow[]) : [];

        const names = rows
          .map((row) => row?.name || row?.["data.name"] || row?.data?.name)
          .filter(Boolean)
          .map((felt) => decodePaddedFeltAscii(String(felt)))
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
                chainManifest as Parameters<typeof patchManifestWithFactory>[0],
                profile.worldAddress,
                profile.contractsBySelector,
              );
              const patchedManifest = patched as ManifestLike;
              const prizeAddress = normalizeHex(
                patchedManifest.contracts?.find((contract) => contract.tag === "s1_eternum-prize_distribution_systems")
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

  const onResolve = useCallback(
    async (options: TxFeedbackOptions = {}): Promise<boolean> => {
      const { suppressErrorToast = false, suppressSuccessToast = false } = options;
      if (serverLookupStatus !== "done") {
        if (!suppressErrorToast) {
          toast.error("Resolving game name… please wait.");
        }
        return false;
      }
      if (!account) {
        if (!suppressErrorToast) {
          toast.error("Connect a wallet to resolve the market.");
        }
        return false;
      }

      const marketAddress = getContractByName(manifest, "pm", "Markets")?.address;
      if (!marketAddress) {
        if (!suppressErrorToast) {
          toast.error("Market contract not found in manifest.");
        }
        return false;
      }

      const resolveCall: Call = {
        contractAddress: marketAddress,
        entrypoint: "resolve",
        calldata: [marketId_u256.low, marketId_u256.high],
      };

      setIsResolving(true);
      try {
        const executeResult = await withTxTimeout(account.execute([resolveCall]), "Resolve transaction");
        await waitForTxConfirmationIfAvailable(
          account as {
            waitForTransaction?: (txHash: string) => Promise<unknown>;
            provider?: {
              waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
              waitForTransaction?: (txHash: string) => Promise<unknown>;
            };
          },
          executeResult,
          "Resolve transaction",
        );
        if (!suppressSuccessToast) {
          toast.success("Market resolved");
        }
        return true;
      } catch (error) {
        console.error("Failed to resolve market", error);
        if (!suppressErrorToast) {
          toast.error("Failed to resolve market");
        }
        return false;
      } finally {
        setIsResolving(false);
      }
    },
    [account, manifest, marketId_u256.high, marketId_u256.low, serverLookupStatus],
  );

  const onComputeScores = useCallback(
    async (options: TxFeedbackOptions = {}): Promise<ComputeScoresResult> => {
      const { suppressErrorToast = false, suppressSuccessToast = false } = options;
      if (hasFinalRanking) {
        if (!suppressSuccessToast) {
          toast.success("Scores are already computed (PlayersRankFinal exists).");
        }
        return "already-computed";
      }
      if (!market.isEnded()) {
        if (!suppressErrorToast) {
          toast.error("Scores can only be computed after the game ends.");
        }
        return "skipped";
      }
      if (!account) {
        if (!suppressErrorToast) {
          toast.error("Connect a wallet to compute scores.");
        }
        return "skipped";
      }
      if (!serverName) {
        if (!suppressErrorToast) {
          toast.error("Could not determine the game name to load players.");
        }
        return "skipped";
      }

      setIsComputingScores(true);
      setComputeStatus("Loading players...");

      try {
        const playerAddresses = await loadPlayers();

        if (playerAddresses.length === 0) {
          setComputeStatus(null);
          if (!suppressErrorToast) {
            toast.error("No registered players found for this game.");
          }
          return "failed";
        }

        setComputeStatus("Resolving prize distribution contract...");
        const chain = env.VITE_PUBLIC_CHAIN as Chain;
        const profile = await buildWorldProfile(chain, serverName);
        const baseManifest = getGameManifest(chain);
        const patchedManifest = patchManifestWithFactory(
          baseManifest as Parameters<typeof patchManifestWithFactory>[0],
          profile.worldAddress,
          profile.contractsBySelector,
        );
        const prizeContract = getContractByName(
          patchedManifest as Parameters<typeof getContractByName>[0],
          "s1_eternum",
          "prize_distribution_systems",
        );
        if (!prizeContract?.address) {
          setComputeStatus(null);
          if (!suppressErrorToast) {
            toast.error("Prize distribution contract not found for this world.");
          }
          return "failed";
        }

        if (playerAddresses.length === 1) {
          const solePlayer = playerAddresses[0];
          if (!solePlayer) {
            setComputeStatus(null);
            if (!suppressErrorToast) {
              toast.error("Could not determine the registered player address.");
            }
            return "failed";
          }

          setComputeStatus("Submitting single-player claim...");
          const claimCall: Call = {
            contractAddress: prizeContract.address,
            entrypoint: "blitz_prize_claim_no_game",
            calldata: [solePlayer],
          };
          const executeResult = await withTxTimeout(account.execute([claimCall]), "Compute scores transaction");
          await waitForTxConfirmationIfAvailable(
            account as {
              waitForTransaction?: (txHash: string) => Promise<unknown>;
              provider?: {
                waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
                waitForTransaction?: (txHash: string) => Promise<unknown>;
              };
            },
            executeResult,
            "Compute scores transaction",
          );
          setComputeStatus("Single-player claim submitted.");
          if (!suppressSuccessToast) {
            toast.success("Single registered player — prize claim submitted.");
          }
          return "submitted";
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
          const executeResult = await withTxTimeout(
            account.execute([rankCall]),
            `Compute scores transaction (batch ${i + 1}/${batches.length})`,
          );
          await waitForTxConfirmationIfAvailable(
            account as {
              waitForTransaction?: (txHash: string) => Promise<unknown>;
              provider?: {
                waitForTransactionWithCheck?: (txHash: string) => Promise<unknown>;
                waitForTransaction?: (txHash: string) => Promise<unknown>;
              };
            },
            executeResult,
            `Compute scores transaction (batch ${i + 1}/${batches.length})`,
          );
        }

        setComputeStatus("Score computation submitted.");
        if (!suppressSuccessToast) {
          toast.success("Scores computation submitted.");
        }
        refetchRanks();
        return "submitted";
      } catch (error) {
        console.error("Failed to compute scores", error);
        setComputeStatus("Failed to compute scores.");
        if (!suppressErrorToast) {
          toast.error("Failed to compute scores");
        }
        return "failed";
      } finally {
        setIsComputingScores(false);
      }
    },
    [account, hasFinalRanking, loadPlayers, market, refetchRanks, serverName],
  );

  const onResolveWithCompute = useCallback(async (): Promise<boolean> => {
    if (isSubmittingTx) {
      return false;
    }

    setIsResolvingWithCompute(true);
    try {
      const computeResult = hasFinalRanking
        ? "already-computed"
        : await onComputeScores({
            suppressErrorToast: true,
            suppressSuccessToast: true,
          });

      const resolved = await onResolve({
        suppressErrorToast: true,
        suppressSuccessToast: true,
      });

      if (resolved) {
        toast.success("Market resolved");
        return true;
      }

      if (computeResult === "failed") {
        toast.error("Failed to compute scores and resolve market.");
      } else {
        toast.error("Failed to resolve market");
      }
      return false;
    } finally {
      setIsResolvingWithCompute(false);
    }
  }, [hasFinalRanking, isSubmittingTx, onComputeScores, onResolve]);

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
  }, [hasFinalRanking, players, playersError, playersLoading, serverLookupStatus]);

  return {
    canResolve,
    canComputeScores,
    hasFinalRanking,
    hasRankedPlayers,
    playersLoading,
    serverLookupStatus,
    isResolving,
    isComputingScores,
    isResolvingWithCompute,
    isSubmittingTx,
    computeStatus,
    playersLabel,
    playerRanks,
    ranksLoading,
    ranksError,
    onResolve: () => onResolve(),
    onComputeScores: () => onComputeScores(),
    onResolveWithCompute,
  };
};

export const MarketResolutionView = ({ resolution }: { resolution: MarketResolutionController }) => {
  const {
    canResolve,
    canComputeScores,
    hasFinalRanking,
    hasRankedPlayers,
    playersLoading,
    serverLookupStatus,
    isResolving,
    isComputingScores,
    isSubmittingTx,
    computeStatus,
    playersLabel,
    playerRanks,
    ranksLoading,
    ranksError,
    onResolve,
    onComputeScores,
  } = resolution;

  return (
    <>
      <div className="mt-1 text-sm text-gold/70">
        Trigger resolution once the oracle data is ready.{" "}
        {serverLookupStatus !== "done" ? "Resolving game name..." : ""}
      </div>

      <VStack className="mt-4 items-start gap-3">
        <HStack className="flex-wrap gap-3">
          <Button onClick={() => void onResolve()} disabled={!canResolve || isSubmittingTx}>
            <span className="flex items-center gap-2">
              {isSubmittingTx ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isResolving ? "Submitting..." : "Resolve Market"}
            </span>
          </Button>
          <Button
            variant="outline"
            onClick={() => void onComputeScores()}
            disabled={!canComputeScores || isSubmittingTx}
          >
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
          <div className="w-full rounded-md border border-gold/15 bg-brown/45 p-3">
            <div className="flex items-center justify-between text-sm text-gold/80">
              <span className="text-lightest font-semibold">Final ranking</span>
            </div>
            {ranksLoading ? <p className="mt-2 text-xs text-gold/60">Loading ranking...</p> : null}
            {ranksError ? <p className="mt-2 text-xs text-danger">{ranksError}</p> : null}
            {!ranksLoading && !ranksError ? (
              playerRanks.length > 0 ? (
                <ol className="mt-3 space-y-2 text-sm text-lightest">
                  {playerRanks.map((entry) => (
                    <li
                      key={`${entry.player}-${entry.rank}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-gold/10 bg-brown/45 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-gold/10 px-2 py-[2px] text-[11px] font-semibold uppercase text-gold/70">
                          #{entry.rank}
                        </span>
                        <MaybeController address={entry.player} className="text-lightest" />
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

export const MarketResolution = ({ market }: { market: MarketClass }) => {
  const resolution = useMarketResolutionController(market);

  return <MarketResolutionView resolution={resolution} />;
};
