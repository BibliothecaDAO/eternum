import { useEffect, useMemo, useState } from "react";
import type { FactoryRun, FactorySeriesChildRun } from "../types";
import {
  canFundFactoryRunPrize,
  isFactoryPrizeFundingChildReady,
  resolveDefaultFactoryPrizeFundingGameNames,
} from "../prize-funding";

interface FactoryV2PrizeFundingCardProps {
  run: FactoryRun;
  isBusy: boolean;
  onSubmit: (request: { amount: string; adminSecret: string; selectedGameNames: string[] }) => Promise<void> | void;
}

interface FactoryV2PrizeFundingSeriesGame {
  gameName: string;
  status: FactorySeriesChildRun["status"];
  configReady: boolean;
  worldAddress?: string;
  isReady: boolean;
  fundedTransferCount: number;
}

interface FactoryV2PrizeFundingState {
  kind: "game" | "series_like";
  gameGroupLabel: string;
  defaultSelectedGameNames: string[];
  games: FactoryV2PrizeFundingSeriesGame[];
}

export const FactoryV2PrizeFundingCard = ({ run, isBusy, onSubmit }: FactoryV2PrizeFundingCardProps) => {
  const fundingState = useMemo(() => resolvePrizeFundingState(run), [run]);
  const fundingStateKey = useMemo(() => buildPrizeFundingStateKey(fundingState), [fundingState]);
  const [amount, setAmount] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [selectedGameNames, setSelectedGameNames] = useState<string[]>(fundingState?.defaultSelectedGameNames ?? []);

  useEffect(() => {
    setAmount("");
    setAdminSecret("");
    setSelectedGameNames(fundingState?.defaultSelectedGameNames ?? []);
  }, [fundingStateKey, run.id]);

  if (!fundingState) {
    return null;
  }

  const isSeriesFunding = fundingState.kind === "series_like";
  const canSubmit = isSeriesFunding ? selectedGameNames.length > 0 : true;
  const latestTransfer = resolveLatestPrizeFundingTransfer(run);
  const fundedCount = fundingState.games.filter((game) => game.fundedTransferCount > 0).length;

  const submitFundingRequest = async () => {
    const normalizedAmount = amount.trim();
    const normalizedSecret = adminSecret.trim();

    if (!normalizedAmount || !normalizedSecret || !canSubmit) {
      return;
    }

    await onSubmit({
      amount: normalizedAmount,
      adminSecret: normalizedSecret,
      selectedGameNames: isSeriesFunding ? selectedGameNames : [],
    });

    setAdminSecret("");
  };

  return (
    <div className="space-y-3 rounded-[24px] border border-black/8 bg-white/40 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="mx-auto max-w-sm space-y-1 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Admin prize funding</div>
        <p className="text-[13px] leading-5 text-black/52">
          Send prizes to each game&apos;s trusted prize distribution address as soon as world setup is ready.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <FactoryV2PrizeFundingMetric
          label={isSeriesFunding ? "Funded games" : "Transfers"}
          value={
            isSeriesFunding
              ? `${fundedCount} of ${fundingState.games.length}`
              : String(run.prizeFunding?.transfers.length ?? 0)
          }
        />
        <FactoryV2PrizeFundingMetric
          label="Latest transfer"
          value={latestTransfer ? formatPrizeFundingTimestamp(latestTransfer.fundedAt) : "Not funded yet"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">Prize amount</span>
          <input
            data-testid="factory-prize-amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={isSeriesFunding ? "Per selected game" : "Token amount"}
            className="w-full rounded-[18px] border border-black/10 bg-white/72 px-3 py-3 text-sm text-black shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition-colors focus:border-[#9d6c35]/50"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">Admin secret</span>
          <input
            data-testid="factory-prize-secret"
            type="password"
            value={adminSecret}
            onChange={(event) => setAdminSecret(event.target.value)}
            placeholder="Required to confirm funding"
            className="w-full rounded-[18px] border border-black/10 bg-white/72 px-3 py-3 text-sm text-black shadow-[0_10px_24px_rgba(15,23,42,0.04)] outline-none transition-colors focus:border-[#9d6c35]/50"
          />
        </label>
      </div>

      {isSeriesFunding ? (
        <FactoryV2PrizeFundingSeriesSelector
          gameGroupLabel={fundingState.gameGroupLabel}
          games={fundingState.games}
          selectedGameNames={selectedGameNames}
          isBusy={isBusy}
          onToggleGame={(gameName) => {
            setSelectedGameNames((currentGameNames) =>
              currentGameNames.includes(gameName)
                ? currentGameNames.filter((currentGameName) => currentGameName !== gameName)
                : [...currentGameNames, gameName],
            );
          }}
        />
      ) : null}

      <div className="space-y-2 text-center">
        {isSeriesFunding ? (
          <p className="text-[13px] leading-5 text-black/52">
            This sends one multicall with one transfer per selected game. Already funded games stay visible so you can
            explicitly resend them when needed, and games that are not ready stay visible until configuration finishes.
          </p>
        ) : (
          <p className="text-[13px] leading-5 text-black/52">
            This sends one ERC20 transfer to the trusted prize distribution address for {run.name}.
          </p>
        )}
        <button
          type="button"
          data-testid="factory-prize-submit"
          disabled={isBusy || !amount.trim() || !adminSecret.trim() || !canSubmit}
          onClick={() => {
            void submitFundingRequest();
          }}
          className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-[#7a4b22] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#6d411c] disabled:cursor-not-allowed disabled:bg-[#7a4b22]/45"
        >
          {isSeriesFunding ? "Fund selected games" : "Fund this game"}
        </button>
      </div>
    </div>
  );
};

const FactoryV2PrizeFundingSeriesSelector = ({
  gameGroupLabel,
  games,
  selectedGameNames,
  isBusy,
  onToggleGame,
}: {
  gameGroupLabel: string;
  games: FactoryV2PrizeFundingSeriesGame[];
  selectedGameNames: string[];
  isBusy: boolean;
  onToggleGame: (gameName: string) => void;
}) => (
  <div className="space-y-2 rounded-[20px] border border-black/8 bg-white/52 p-3">
    <div className="mx-auto max-w-sm space-y-1 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/42">{gameGroupLabel}</div>
      <p className="text-[13px] leading-5 text-black/52">
        Eligible unfunded games are selected by default. Funded games stay reselectable and not-ready games stay
        visible.
      </p>
    </div>
    <div className="space-y-2">
      {games.map((game) => {
        const isSelectable = game.isReady;
        const isSelected = selectedGameNames.includes(game.gameName);

        return (
          <label
            key={game.gameName}
            className="flex items-center gap-3 rounded-[18px] border border-black/8 bg-white/72 px-3 py-3 text-left"
          >
            <input
              data-testid={`factory-prize-game-${game.gameName}`}
              type="checkbox"
              checked={isSelected}
              disabled={!isSelectable || isBusy}
              onChange={() => onToggleGame(game.gameName)}
              className="h-4 w-4 rounded border-black/20 text-[#7a4b22] focus:ring-[#7a4b22]/40"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-black">{game.gameName}</div>
              <div className="text-[12px] text-black/48">{resolvePrizeFundingGameStatusLabel(game)}</div>
            </div>
          </label>
        );
      })}
    </div>
  </div>
);

const FactoryV2PrizeFundingMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[18px] border border-black/8 bg-white/62 px-3 py-3 text-center">
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">{label}</div>
    <div className="mt-1 text-[13px] font-semibold text-black">{value}</div>
  </div>
);

function resolvePrizeFundingState(run: FactoryRun): FactoryV2PrizeFundingState | null {
  if (!canFundFactoryRunPrize(run)) {
    return null;
  }

  if (run.kind === "game") {
    return {
      kind: "game",
      gameGroupLabel: "Games",
      defaultSelectedGameNames: [],
      games: [],
    };
  }

  if (!run.children || run.children.length === 0) {
    return null;
  }

  const games = run.children.map((child) => ({
    gameName: child.gameName,
    status: child.status,
    configReady: Boolean(child.configReady),
    worldAddress: child.worldAddress,
    isReady: isFactoryPrizeFundingChildReady(child),
    fundedTransferCount: child.prizeFunding?.transfers.length ?? 0,
  }));

  return {
    kind: "series_like",
    gameGroupLabel: run.kind === "rotation" ? "Rotation games" : "Series games",
    defaultSelectedGameNames: resolveDefaultFactoryPrizeFundingGameNames(run),
    games,
  };
}

function resolvePrizeFundingGameStatusLabel(game: FactoryV2PrizeFundingSeriesGame) {
  if (!game.worldAddress) {
    return "World not created yet";
  }

  if (!game.configReady) {
    return "World config not finished";
  }

  if (game.fundedTransferCount > 0) {
    return game.fundedTransferCount === 1 ? "Already funded once" : `Already funded ${game.fundedTransferCount} times`;
  }

  return "Ready to fund";
}

function resolveLatestPrizeFundingTransfer(run: FactoryRun) {
  const runTransfers = run.prizeFunding?.transfers ?? [];
  const childTransfers = (run.children ?? []).flatMap((child) => child.prizeFunding?.transfers ?? []);

  return [...runTransfers, ...childTransfers].sort((left, right) => right.fundedAt.localeCompare(left.fundedAt))[0];
}

function formatPrizeFundingTimestamp(timestamp: string) {
  const parsedTimestamp = Date.parse(timestamp);

  if (!Number.isFinite(parsedTimestamp)) {
    return timestamp;
  }

  return new Date(parsedTimestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildPrizeFundingStateKey(state: FactoryV2PrizeFundingState | null) {
  if (!state) {
    return "none";
  }

  return JSON.stringify({
    kind: state.kind,
    defaultSelectedGameNames: state.defaultSelectedGameNames,
    games: state.games,
  });
}
