import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAccountStore } from "@/hooks/store/use-account-store";
import { toast } from "sonner";
import { CairoCustomEnum, Call, CallData, uint256, type RawArgsObject, type Uint256 } from "starknet";

import { useDojoSdk } from "@/pm/hooks/dojo/use-dojo-sdk";
import { buildWorldProfile, patchManifestWithFactory } from "@/runtime/world";
import { ChainType } from "@/ui/features/admin/utils/manifest-loader";
import { Chain, getGameManifest } from "@contracts";
import { getContractByName } from "@dojoengine/core";
import { env } from "../../../../../env";
import { MarketServerCard, type MarketServerFormState } from "./markets/market-server-card";
import {
  addressToUint256,
  deriveServerStatus,
  formatSecondsToLocalInput,
  parseLordsToBaseUnits,
  stringToHexData,
} from "./markets/market-utils";
import { useMarketServers, type MarketServer } from "./markets/use-market-servers";

const tryBetterErrorMsg = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Something went wrong while creating the market.";
};

// TODO: need to change all these addresses depending on if i'm on slot or mainnet
const DEFAULT_COLLATERAL_TOKEN = "0x062cbbb9e30d90264ac63586d4f000be3cf5c178f11ae48f11f8b659eb060ac5";
const DEFAULT_ORACLE_ADDRESS = "0x0693278fb06d7041f884c50cb9d0e2d4620ed16f282cf8c76fddb712ef1060d2";
const CREATOR_FEE = "10";
const DEFAULT_FUNDING_LORDS = "1000";
const DEFAULT_FEE_CURVE_RANGE = {
  start: 0,
  end: 2000,
};
const DEFAULT_FEE_SHARE_CURVE_RANGE = {
  start: 10000,
  end: 0,
};
const getOracleParams = (blitzOracleAddress: string) => [
  "0",
  BigInt(blitzOracleAddress),
  "0x0",
  "0x626c69747a5f6765745f77696e6e6572",
  "0x10",
  "0",
  // "0",
  // "3038007332165199338266024285300727230862136446917353564549635676187981469583",
  // "0x0",
  // "0x6765745f736561736f6e5f77696e6e6572",
  // "0x11",
  // "1",
  // "0",
];
const DEFAULT_ORACLE_EXTRA_PARAMS = ["0"];
const buildOracleValueTypeEnum = () =>
  new CairoCustomEnum({
    u256: undefined,
    ContractAddress: {},
    felt252: undefined,
  });

const buildFeeCurveEnum = (range: { start: number; end: number }) =>
  new CairoCustomEnum({
    Linear: {
      start: range.start,
      end: range.end,
    },
  });

const buildVaultModelEnum = (initialRepartition: number[], fundingAmount: Uint256) =>
  new CairoCustomEnum({
    Vault: {
      initial_repartition: initialRepartition,
      funding_amount: fundingAmount,
      fee_curve: buildFeeCurveEnum(DEFAULT_FEE_CURVE_RANGE),
      fee_share_curve: buildFeeCurveEnum(DEFAULT_FEE_SHARE_CURVE_RANGE),
    },
    Amm: undefined,
  });

const buildCategoricalMarketTypeEnum = (outcomes: Uint256[]) =>
  new CairoCustomEnum({
    Binary: undefined,
    Categorical: new CairoCustomEnum({
      ValueEq: outcomes,
      Ranges: undefined,
    }),
  });

type VariantShape = { variant: Record<string, unknown> };

const isVariantShape = (value: unknown): value is VariantShape =>
  Boolean(value && typeof value === "object" && "variant" in (value as Record<string, unknown>));

const normalizeVariants = (value: unknown): unknown => {
  if (value instanceof CairoCustomEnum) return value;
  if (isVariantShape(value)) {
    const entries = Object.entries(value.variant).map(([variantKey, variantValue]) => [
      variantKey,
      normalizeVariants(variantValue),
    ]);
    return new CairoCustomEnum(Object.fromEntries(entries));
  }
  if (Array.isArray(value)) return value.map((item) => normalizeVariants(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [key, normalizeVariants(nestedValue)]));
  }
  return value;
};

type BuildResult = { params: RawArgsObject; fundingBase: bigint } | { error: string };

type LandingCreateMarketProps = {
  includeEnded?: boolean;
};

const normalizeTimeInputValue = (value?: string, fallback = ""): string => {
  if (!value) return fallback;
  if (value.includes("T")) return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return formatSecondsToLocalInput(numeric);
  return value;
};

const ensureForm = (
  form?: MarketServerFormState,
  defaults?: Partial<Pick<MarketServerFormState, "startAt" | "endAt" | "resolveAt" | "title">>,
): MarketServerFormState => {
  return {
    fundingAmount: form?.fundingAmount || DEFAULT_FUNDING_LORDS,
    weights: form?.weights || {},
    noneWeight: form?.noneWeight ?? 1,
    startAt: normalizeTimeInputValue(form?.startAt, defaults?.startAt ?? ""),
    endAt: normalizeTimeInputValue(form?.endAt, defaults?.endAt ?? ""),
    resolveAt: normalizeTimeInputValue(form?.resolveAt, defaults?.resolveAt ?? ""),
    title: form?.title ?? defaults?.title ?? "",
  };
};

const buildDefaultSchedule = (server: MarketServer) => {
  const start = server.startAt ?? null;
  const end = server.endAt && server.endAt !== 0 ? server.endAt : start;
  const resolve = end != null ? end + 60 : start != null ? start + 60 : null;

  return {
    startAt: formatSecondsToLocalInput(start),
    endAt: formatSecondsToLocalInput(end),
    resolveAt: formatSecondsToLocalInput(resolve),
    title: server.name ? server.name.padEnd(10, " ") : "",
  };
};

const parseTimestampInput = (label: string, value?: string): { value: number | null; error?: string } => {
  const trimmed = value?.trim();
  if (!trimmed) return { value: null };
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) return { value: Math.floor(parsed) };

  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const ms = Date.parse(normalized);
  if (!Number.isNaN(ms)) return { value: Math.floor(ms / 1000) };

  return { value: null, error: `Enter a valid ${label} time (unix seconds or yyyy-mm-ddThh:mm).` };
};

const buildMarketParams = (
  server: MarketServer,
  form: MarketServerFormState,
  nowSec: number,
  blitzOracleAddress?: string | null,
): BuildResult => {
  if (!server.playersLoaded || server.players.length === 0) {
    return { error: "Load registered players first." };
  }

  const weights = server.players.map((player) => Math.max(0, form.weights[player.address] ?? 1));
  const noneWeight = Math.max(0, form.noneWeight ?? 1);
  const totalWeight = weights.reduce((acc, value) => acc + value, 0) + noneWeight;

  if (totalWeight <= 0) {
    return { error: "Set at least one non-zero chance value." };
  }

  const fundingBase = parseLordsToBaseUnits(form.fundingAmount);
  if (fundingBase == null) {
    return { error: "Enter a valid funding amount in LORDS." };
  }

  if (!blitzOracleAddress) {
    return { error: "Oracle address is not resolved for this world yet." };
  }

  const fundingAmount = uint256.bnToUint256(fundingBase);
  const { value: startOverride, error: startError } = parseTimestampInput("start", form.startAt);
  const { value: endOverride, error: endError } = parseTimestampInput("end", form.endAt);
  const { value: resolveOverride, error: resolveError } = parseTimestampInput("resolve", form.resolveAt);
  const titleOverrideRaw = form.title ?? "";

  if (startError) return { error: startError };
  if (endError) return { error: endError };
  if (resolveError) return { error: resolveError };

  const startAt = startOverride ?? server.startAt ?? nowSec;
  const endAt = endOverride ?? (server.endAt && server.endAt !== 0 ? server.endAt : startAt);
  const resolveAt = resolveOverride ?? endAt + 60;

  if (endAt < startAt) {
    return { error: "End time must be after or equal to start time." };
  }

  if (resolveAt < endAt) {
    return { error: "Resolve time must be after or equal to end time." };
  }

  const defaultTitle = server.name.padEnd(10, " ");
  const hasCustomTitle = titleOverrideRaw.trim().length > 0 && titleOverrideRaw !== defaultTitle;
  const titleText = hasCustomTitle ? titleOverrideRaw.trim() : defaultTitle;
  // const titleData = stringToHexData(`Who wins ${server.name}?`);
  // const questionData = stringToHexData(`Predict the winner on ${server.name}`);
  const titleData = stringToHexData(titleText);
  const questionData = stringToHexData("Who will be the winner?");

  const params = normalizeVariants({
    oracle: DEFAULT_ORACLE_ADDRESS,
    collateral_token: DEFAULT_COLLATERAL_TOKEN,
    model: buildVaultModelEnum([...weights, noneWeight], fundingAmount),
    oracle_params: getOracleParams(blitzOracleAddress),
    oracle_extra_params: DEFAULT_ORACLE_EXTRA_PARAMS,
    oracle_value_type: buildOracleValueTypeEnum(),
    typ: buildCategoricalMarketTypeEnum(server.players.map((player) => addressToUint256(player.address))),
    start_at: String(startAt ?? 0),
    end_at: String(endAt ?? startAt ?? 0),
    resolve_at: String(resolveAt ?? endAt ?? startAt ?? 0),
    title: {
      data: [],
      pending_word: titleData.hex,
      pending_word_len: titleData.length,
    },
    question: {
      data: [],
      pending_word: questionData.hex,
      pending_word_len: questionData.length,
    },
    creator_fee: CREATOR_FEE,
  }) as RawArgsObject;

  return { params, fundingBase };
};

export const LandingCreateMarket = ({ includeEnded = false }: LandingCreateMarketProps = {}) => {
  const {
    config: { manifest },
  } = useDojoSdk();
  const account = useAccountStore((state) => state.account);
  const { servers, loading, error, nowSec, refresh, loadPlayers } = useMarketServers({
    allowFakePlayerFallback: includeEnded,
  });

  const marketAddress = getContractByName(manifest, "pm", "Markets")?.address;
  const [forms, setForms] = useState<Record<string, MarketServerFormState>>({});
  const [creatingServer, setCreatingServer] = useState<string | null>(null);
  const [blitzOracleAddresses, setBlitzOracleAddresses] = useState<Partial<Record<string, string | null>>>({});
  const oracleFetchInFlight = useRef(new Set<string>());

  const resolveBlitzOracleAddress = useCallback(async (worldName: string) => {
    const chain = env.VITE_PUBLIC_CHAIN as ChainType;
    const profile = await buildWorldProfile(chain as Chain, worldName);
    const baseManifest = getGameManifest(chain as Chain);
    const patched = patchManifestWithFactory(baseManifest as any, profile.worldAddress, profile.contractsBySelector);
    const address = (patched as any)?.contracts?.find(
      (contract: any) => contract.tag === "s1_eternum-prize_distribution_systems",
    )?.address;
    return address ?? null;
  }, []);

  useEffect(() => {
    servers.forEach((server) => {
      if (blitzOracleAddresses[server.name] !== undefined || oracleFetchInFlight.current.has(server.name)) {
        return;
      }

      oracleFetchInFlight.current.add(server.name);
      void (async () => {
        try {
          const address = await resolveBlitzOracleAddress(server.name);
          setBlitzOracleAddresses((prev) => ({ ...prev, [server.name]: address }));
        } catch (e) {
          console.error(`[markets] Failed to resolve blitz oracle address for ${server.name}`, e);
          setBlitzOracleAddresses((prev) => ({ ...prev, [server.name]: null }));
        } finally {
          oracleFetchInFlight.current.delete(server.name);
        }
      })();
    });
  }, [blitzOracleAddresses, resolveBlitzOracleAddress, servers]);

  const eligibleServers = useMemo(
    () =>
      servers.filter((server) => {
        const status = deriveServerStatus(server.startAt, server.endAt, nowSec);
        return status === "started" || (includeEnded && status === "ended");
      }),
    [includeEnded, nowSec, servers],
  );

  useEffect(() => {
    setForms((prev) => {
      const next = { ...prev };
      let changed = false;

      servers.forEach((server) => {
        const defaults = buildDefaultSchedule(server);
        const existing = ensureForm(next[server.name], defaults);
        const weights = { ...existing.weights };
        const playerAddresses = new Set(server.players.map((p) => p.address));
        server.players.forEach((player) => {
          if (weights[player.address] == null) weights[player.address] = 1;
        });
        Object.keys(weights).forEach((address) => {
          if (!playerAddresses.has(address)) delete weights[address];
        });

        const updated: MarketServerFormState = {
          fundingAmount: existing.fundingAmount || DEFAULT_FUNDING_LORDS,
          weights,
          noneWeight: existing.noneWeight ?? 1,
          startAt: existing.startAt ?? defaults.startAt,
          endAt: existing.endAt ?? defaults.endAt,
          resolveAt: existing.resolveAt ?? defaults.resolveAt,
          title: existing.title ?? defaults.title,
        };

        const previous = prev[server.name];
        const weightsChanged =
          !previous ||
          Object.keys(previous.weights || {}).length !== Object.keys(weights).length ||
          Object.keys(weights).some((key) => previous.weights?.[key] !== weights[key]);
        const fundingChanged = previous ? previous.fundingAmount !== updated.fundingAmount : true;
        const noneChanged = previous ? previous.noneWeight !== updated.noneWeight : true;
        const startChanged = previous ? previous.startAt !== updated.startAt : true;
        const endChanged = previous ? previous.endAt !== updated.endAt : true;
        const resolveChanged = previous ? previous.resolveAt !== updated.resolveAt : true;
        const titleChanged = previous ? previous.title !== updated.title : true;

        if (
          !previous ||
          weightsChanged ||
          fundingChanged ||
          noneChanged ||
          startChanged ||
          endChanged ||
          resolveChanged ||
          titleChanged
        ) {
          next[server.name] = updated;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [servers]);

  const handleWeightChange = useCallback((serverName: string, address: string, value: number) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        weights: {
          ...ensureForm(prev[serverName]).weights,
          [address]: value,
        },
      },
    }));
  }, []);

  const handleNoneWeightChange = useCallback((serverName: string, value: number) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        noneWeight: value,
      },
    }));
  }, []);

  const handleFundingChange = useCallback((serverName: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        fundingAmount: value,
      },
    }));
  }, []);

  const handleStartAtChange = useCallback((serverName: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        startAt: value,
      },
    }));
  }, []);

  const handleEndAtChange = useCallback((serverName: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        endAt: value,
      },
    }));
  }, []);

  const handleResolveAtChange = useCallback((serverName: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        resolveAt: value,
      },
    }));
  }, []);

  const handleTitleChange = useCallback((serverName: string, value: string) => {
    setForms((prev) => ({
      ...prev,
      [serverName]: {
        ...ensureForm(prev[serverName]),
        title: value,
      },
    }));
  }, []);

  const handleDebug = useCallback(
    (server: MarketServer, blitzOracleAddress: string | null | undefined) => {
      const form = ensureForm(forms[server.name]);
      const result = buildMarketParams(server, form, nowSec, blitzOracleAddress);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      console.log(`[markets] Debug params for ${server.name}`, result.params);
      toast.success("Logged market params to console");
    },
    [forms, nowSec],
  );

  const handleCreate = useCallback(
    async (server: MarketServer, blitzOracleAddress: string | null | undefined) => {
      if (!account) {
        toast.error("Connect a wallet to create a market.");
        return;
      }

      const targetMarketAddress = marketAddress.trim();
      if (!targetMarketAddress) {
        toast.error("Market contract address is not configured.");
        return;
      }

      const form = ensureForm(forms[server.name]);
      const result = buildMarketParams(server, form, nowSec, blitzOracleAddress);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      const { params, fundingBase } = result;
      const approveCall: Call = {
        contractAddress: DEFAULT_COLLATERAL_TOKEN,
        entrypoint: "approve",
        calldata: [targetMarketAddress, uint256.bnToUint256(fundingBase)],
      };

      const createMarketCall: Call = {
        contractAddress: targetMarketAddress,
        entrypoint: "create_market",
        calldata: CallData.compile([params]),
      };

      console.log({ compiledData: CallData.compile([params]), params });

      try {
        setCreatingServer(server.name);
        await account.estimateInvokeFee([approveCall, createMarketCall], {
          blockIdentifier: "pre_confirmed",
        });

        const resultTx = await account.execute([approveCall, createMarketCall]);

        if ("waitForTransaction" in account && typeof account.waitForTransaction === "function") {
          await account.waitForTransaction(resultTx.transaction_hash);
        }

        toast.success(`Market created for ${server.name}`);
      } catch (e) {
        console.error(e);
        toast.error(tryBetterErrorMsg(e));
      } finally {
        setCreatingServer(null);
      }
    },
    [account, forms, marketAddress, nowSec],
  );

  const sectionTitle = useMemo(() => {
    const active = eligibleServers.length;
    if (active === 0) return includeEnded ? "Prediction Markets (test)" : "Prediction Markets";
    const descriptor = includeEnded ? "started/ended" : "started";
    return `Prediction Markets • ${active} ${descriptor} server${active === 1 ? "" : "s"}`;
  }, [eligibleServers, includeEnded]);

  return (
    <section
      aria-label="Prediction markets"
      className="relative h-[70vh] w-full max-w-5xl space-y-8 overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/40 to-black/90 p-8 text-white shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 rounded-2xl border border-gold/30 bg-black/40 p-6 shadow-lg shadow-black/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gold">{sectionTitle}</h2>
            <p className="text-sm text-gold/70">
              Choose a live server, inspect its registered players, and craft a market once the game is underway.
              Start/end times below are shown in your local time.
              {includeEnded ? " Ended games are shown here so you can backfill markets." : ""}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right text-[11px] text-gold/70 sm:items-end">
            <span className="text-xs font-semibold uppercase tracking-wide text-gold/70">Market contract address</span>
            <span className="text-sm text-gold">{marketAddress || "Not configured"}</span>
            <button type="button" onClick={() => void refresh()} className="text-gold hover:text-gold/80">
              Refresh servers
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-gold/70">Checking live servers…</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="grid grid-cols-1 gap-4">
          {eligibleServers.map((server) => {
            const status = deriveServerStatus(server.startAt, server.endAt, nowSec);
            const form = ensureForm(forms[server.name]);
            const blitzOracleAddress = blitzOracleAddresses[server.name];
            const oracleReady = Boolean(blitzOracleAddress);
            const oracleLoading = blitzOracleAddress === undefined;
            const totalWeight =
              server.players.reduce((acc, player) => acc + (form.weights[player.address] ?? 1), 0) +
              (form.noneWeight ?? 0);
            const canCreate = server.playersLoaded && server.players.length > 0 && totalWeight > 0 && oracleReady;

            const disableReason = (() => {
              if (!server.playersLoaded || server.players.length === 0) return "Load players to seed outcomes.";
              if (totalWeight <= 0) return "Set non-zero chances.";
              if (oracleLoading) return "Resolving oracle address...";
              if (!oracleReady) return "Could not resolve oracle address for this world.";
              return undefined;
            })();

            return (
              <MarketServerCard
                key={server.name}
                server={server}
                status={status}
                form={form}
                canCreate={canCreate}
                disableReason={disableReason}
                creating={creatingServer === server.name}
                onLoadPlayers={() => loadPlayers(server.name)}
                onWeightChange={(address, value) => handleWeightChange(server.name, address, value)}
                onNoneWeightChange={(value) => handleNoneWeightChange(server.name, value)}
                onFundingChange={(value) => handleFundingChange(server.name, value)}
                onStartAtChange={(value) => handleStartAtChange(server.name, value)}
                onEndAtChange={(value) => handleEndAtChange(server.name, value)}
                onResolveAtChange={(value) => handleResolveAtChange(server.name, value)}
                onTitleChange={(value) => handleTitleChange(server.name, value)}
                onDebug={() => handleDebug(server, blitzOracleAddress)}
                onCreate={() => void handleCreate(server, blitzOracleAddress)}
              />
            );
          })}
        </div>

        {eligibleServers.length === 0 && !loading && !error && (
          <div className="rounded-xl border border-gold/20 bg-black/60 p-4 text-center text-gold/70">
            {includeEnded
              ? "No started or ended servers detected right now (registration games are hidden)."
              : "No started servers detected right now (registration or ended games are hidden)."}
          </div>
        )}

        <div className="rounded-xl border border-gold/20 bg-black/60 p-4 text-xs text-gold/60">
          <p>start_at, end_at, and resolve_at come from each server&apos;s schedule (resolve_at mirrors end_at).</p>
          <p className="mt-1">All times above are displayed in your local timezone.</p>
        </div>
      </div>
    </section>
  );
};

export const LandingCreateMarketTest = () => <LandingCreateMarket includeEnded />;
