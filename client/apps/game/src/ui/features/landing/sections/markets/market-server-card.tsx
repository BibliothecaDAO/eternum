import clsx from "clsx";
import { Clock3, Loader2, Percent, Users } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import { Button, NumberInput } from "@/ui/design-system/atoms";
import { displayAddress } from "@/ui/utils/utils";

import { formatSecondsToLocalInput, formatTimestamp, type MarketServerStatus } from "./market-utils";
import { type MarketServer } from "./use-market-servers";

export type MarketServerFormState = {
  weights: Record<string, number>;
  noneWeight: number;
  fundingAmount: string;
  startAt?: string;
  endAt?: string;
  resolveAt?: string;
  title?: string;
};

type MarketServerCardProps = {
  server: MarketServer;
  status: MarketServerStatus;
  form: MarketServerFormState;
  canCreate: boolean;
  disableReason?: string;
  creating?: boolean;
  onWeightChange: (address: string, value: number) => void;
  onNoneWeightChange: (value: number) => void;
  onFundingChange: (value: string) => void;
  onStartAtChange: (value: string) => void;
  onEndAtChange: (value: string) => void;
  onResolveAtChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onCreate: () => void;
  onDebug: () => void;
  onLoadPlayers: () => void;
};

const statusStyles: Record<MarketServerStatus, string> = {
  registration: "bg-gold/10 text-gold border-gold/30",
  started: "bg-brilliance/10 text-brilliance border-brilliance/30",
  ended: "bg-danger/10 text-danger border-danger/30",
};

export const MarketServerCard = ({
  server,
  status,
  form,
  canCreate,
  disableReason,
  creating,
  onWeightChange,
  onNoneWeightChange,
  onFundingChange,
  onStartAtChange,
  onEndAtChange,
  onResolveAtChange,
  onTitleChange,
  onCreate,
  onDebug,
  onLoadPlayers,
}: MarketServerCardProps) => {
  const playersCount = server.registrationCount ?? (server.playersLoaded ? server.players.length : 0);

  const totalWeight = useMemo(() => {
    const playerWeights = server.players.map((p) => form.weights[p.address] ?? 1);
    return playerWeights.reduce((acc, value) => acc + value, 0) + (form.noneWeight ?? 0);
  }, [form.noneWeight, form.weights, server.players]);

  useEffect(() => {
    if (!server.playersLoaded && !server.loadingPlayers && !server.playerError) {
      onLoadPlayers();
    }
  }, [onLoadPlayers, server.loadingPlayers, server.playerError, server.playersLoaded]);

  const renderPlayerProbability = (weight: number) => {
    if (!totalWeight) return "0%";
    return `${((weight / totalWeight) * 100).toFixed(1)}%`;
  };

  const defaultSchedule = useMemo(() => {
    const start = server.startAt ?? null;
    const end = server.endAt && server.endAt !== 0 ? server.endAt : start;
    const resolve = end != null ? end + 60 : start != null ? start + 60 : null;
    return {
      start,
      end,
      resolve,
      startLocal: formatSecondsToLocalInput(start),
      endLocal: formatSecondsToLocalInput(end),
      resolveLocal: formatSecondsToLocalInput(resolve),
    };
  }, [server.endAt, server.startAt]);

  const toInputValue = useCallback((value: string | undefined, fallback: string) => {
    if (value === undefined) return fallback;
    if (value === "") return "";
    if (value.includes("T")) return value;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return formatSecondsToLocalInput(numeric);
    return fallback;
  }, []);

  return (
    <div className="rounded-2xl border border-gold/20 bg-black/40 p-4 shadow-lg shadow-black/30">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-gold">{server.name}</h3>
          <div className="flex flex-wrap items-center gap-3 text-xs text-gold/70">
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" />
              {playersCount} registered{server.playersLoaded ? ` • ${server.players.length} loaded` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              Starts: {formatTimestamp(server.startAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              Ends: {formatTimestamp(server.endAt ?? server.startAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-4 w-4" />
              Resolve: {formatTimestamp(server.endAt ?? server.startAt)}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={clsx("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", statusStyles[status])}>
            <div className={clsx("h-2 w-2 rounded-full", status === "started" ? "bg-brilliance" : status === "ended" ? "bg-danger" : "bg-gold")} />
            {status === "registration" ? "Registration" : status === "started" ? "Started" : "Ended"}
          </span>
          {server.loadingPlayers && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gold/70">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading players…
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-gold/20 bg-black/50 p-3">
        <div className="text-sm font-semibold text-gold">Schedule overrides (local time)</div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gold/60">Start time</span>
            <input
              type="datetime-local"
              value={toInputValue(form.startAt, defaultSchedule.startLocal)}
              onChange={(e) => onStartAtChange(e.target.value)}
              placeholder={defaultSchedule.startLocal}
              className="w-full rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-sm text-gold outline-none transition focus:border-gold/60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gold/60">End time</span>
            <input
              type="datetime-local"
              value={toInputValue(form.endAt, defaultSchedule.endLocal)}
              onChange={(e) => onEndAtChange(e.target.value)}
              placeholder={defaultSchedule.endLocal}
              className="w-full rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-sm text-gold outline-none transition focus:border-gold/60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gold/60">Resolve time</span>
            <input
              type="datetime-local"
              value={toInputValue(form.resolveAt, defaultSchedule.resolveLocal)}
              onChange={(e) => onResolveAtChange(e.target.value)}
              placeholder={defaultSchedule.resolveLocal}
              className="w-full rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-sm text-gold outline-none transition focus:border-gold/60"
            />
          </div>
        </div>
        <p className="text-xs text-gold/60">
          Edit in your local timezone (datetime-local). Leave blank to use the server schedule (Start:{" "}
          {formatTimestamp(defaultSchedule.start)}, End: {formatTimestamp(defaultSchedule.end)}, Resolve:{" "}
          {formatTimestamp(defaultSchedule.resolve)}). You can also paste unix seconds; they&apos;ll convert automatically.
        </p>
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-gold/20 bg-black/50 p-3">
        <div className="text-sm font-semibold text-gold">Market title</div>
        <input
          value={form.title ?? ""}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={`Who wins ${server.name}?`}
          className="w-full rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-sm text-gold outline-none transition focus:border-gold/60"
        />
        <p className="text-xs text-gold/60">
          Optional override. Leave blank to use the default title for this server.
        </p>
      </div>
      <div className="mt-4 space-y-3 rounded-xl border border-gold/20 bg-gold/5 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Percent className="h-4 w-4" />
          Initial chances
        </div>
        {server.loadingPlayers && <p className="text-sm text-gold/70">Loading players…</p>}
        {server.playerError && <p className="text-sm text-danger">{server.playerError}</p>}
        {server.playersLoaded && server.players.length > 0 ? (
          <div className="space-y-2">
            {server.players.map((player) => {
              const weight = form.weights[player.address] ?? 1;
              return (
                <div
                  key={player.address}
                  className="grid grid-cols-1 gap-2 rounded-lg border border-gold/15 bg-black/30 p-3 sm:grid-cols-3 sm:items-center"
                >
                  <div className="min-w-0 sm:col-span-1 sm:pr-2">
                    <div className="truncate text-sm font-semibold text-gold">{player.name || displayAddress(player.address)}</div>
                    <div className="truncate text-[11px] text-gold/60">{displayAddress(player.address)}</div>
                  </div>
                  <div className="sm:col-span-1 sm:px-2">
                    <NumberInput
                      value={weight}
                      min={0}
                      step={1}
                      arrows={false}
                      className="w-full"
                      onChange={(value) => onWeightChange(player.address, value)}
                    />
                  </div>
                  <div className="sm:col-span-1 sm:pl-2 text-sm font-semibold text-gold/80 sm:text-right">{renderPlayerProbability(weight)}</div>
                </div>
              );
            })}
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-gold/15 bg-black/20 p-3 sm:grid-cols-3 sm:items-center">
              <div className="min-w-0 sm:col-span-1 sm:pr-2">
                <div className="truncate text-sm font-semibold text-gold">None of the listed players</div>
                <div className="truncate text-[11px] text-gold/60">Fallback outcome</div>
              </div>
              <div className="sm:col-span-1 sm:px-2">
                <NumberInput
                  value={form.noneWeight ?? 1}
                  min={0}
                  step={1}
                  arrows={false}
                  className="w-full"
                  onChange={(value) => onNoneWeightChange(value)}
                />
              </div>
              <div className="sm:col-span-1 sm:pl-2 text-sm font-semibold text-gold/80 sm:text-right">{renderPlayerProbability(form.noneWeight ?? 1)}</div>
            </div>
          </div>
        ) : (
          !server.loadingPlayers && <p className="text-sm text-gold/70">Load players to set initial chances.</p>
        )}
      </div>

      <div className="mt-4 space-y-2 rounded-xl border border-gold/20 bg-black/50 p-3">
        <div className="text-sm font-semibold text-gold">Funding amount (in $LORDS)</div>
        <input
          value={form.fundingAmount}
          onChange={(e) => onFundingChange(e.target.value)}
          placeholder="100"
          className="w-full rounded-lg border border-gold/30 bg-black/30 px-3 py-2 text-sm text-gold outline-none transition focus:border-gold/60"
        />
        <p className="text-xs text-gold/60">
          The vault will lock this funding amount. Approve + create calls will use this value.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          disabled={!canCreate || creating}
          onClick={onCreate}
          className={clsx(!canCreate ? "opacity-60" : "", "sm:w-auto")}
        >
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create market
        </Button>
        <Button variant="outline" onClick={onDebug} className="sm:w-auto">
          Debug params
        </Button>
        {!canCreate && disableReason && <span className="text-xs text-gold/70">{disableReason}</span>}
      </div>
    </div>
  );
};
