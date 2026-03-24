import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  clearFactoryV2AdminSecret,
  readFactoryV2AdminSecret,
  writeFactoryV2AdminSecret,
} from "../admin-secret-storage";
import type { FactoryWorkerIndexerTier, FactoryWorkerLiveIndexerEntry } from "../api/factory-worker";

interface FactoryV2ManageIndexersWorkspaceProps {
  environmentLabel: string;
  liveIndexers: FactoryWorkerLiveIndexerEntry[];
  liveIndexersUpdatedAt: string | null;
  notice: string | null;
  isBusy: boolean;
  onLoadLiveIndexers: (request: { adminSecret: string; gameNames: string[] }) => Promise<void> | void;
  onRefreshLiveIndexers: (request: { adminSecret: string; gameNames: string[] }) => Promise<void> | void;
  onCreateIndexers: (request: { adminSecret: string; gameNames: string[] }) => Promise<void> | void;
  onUpdateIndexerTier: (request: {
    adminSecret: string;
    gameNames: string[];
    tier: FactoryWorkerIndexerTier;
  }) => Promise<void> | void;
  onDeleteIndexers: (request: { adminSecret: string; gameNames: string[] }) => Promise<void> | void;
}

const INDEXER_TIERS: FactoryWorkerIndexerTier[] = ["basic", "pro", "legendary", "epic"];

const PRIMARY_CARD_CLASS_NAME =
  "rounded-[30px] border border-black/8 bg-[linear-gradient(180deg,rgba(255,250,244,0.98),rgba(255,244,232,0.94))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]";

const QUIET_CARD_CLASS_NAME =
  "rounded-[28px] border border-black/8 bg-[rgba(255,252,248,0.94)] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.05)]";

const ACTION_BAR_CLASS_NAME =
  "sticky bottom-3 z-10 space-y-4 rounded-[26px] border border-black/10 bg-[rgba(255,248,240,0.96)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_18px_42px_rgba(23,15,8,0.16)] backdrop-blur-xl md:static md:px-5 md:py-5 md:shadow-[0_18px_40px_rgba(15,23,42,0.06)] md:backdrop-blur-0";

export const FactoryV2ManageIndexersWorkspace = ({
  environmentLabel,
  liveIndexers,
  liveIndexersUpdatedAt,
  notice,
  isBusy,
  onLoadLiveIndexers,
  onRefreshLiveIndexers,
  onCreateIndexers,
  onUpdateIndexerTier,
  onDeleteIndexers,
}: FactoryV2ManageIndexersWorkspaceProps) => {
  const [lookupNamesText, setLookupNamesText] = useState("");
  const [showsLookupPanel, setShowsLookupPanel] = useState(false);
  const [adminSecret, setAdminSecret] = useState(() => readFactoryV2AdminSecret());
  const [hasStoredSecret, setHasStoredSecret] = useState(() => readFactoryV2AdminSecret().trim().length > 0);
  const [selectedGameNames, setSelectedGameNames] = useState<string[]>([]);
  const autoLoadedSecretKeyRef = useRef<string | null>(null);
  const normalizedAdminSecret = adminSecret.trim();
  const lookupGameNames = useMemo(() => parseIndexerGameNames(lookupNamesText), [lookupNamesText]);
  const availableGameNames = useMemo(() => liveIndexers.map((entry) => entry.gameName), [liveIndexers]);
  const selectedLiveIndexers = useMemo(
    () => liveIndexers.filter((entry) => selectedGameNames.includes(entry.gameName)),
    [liveIndexers, selectedGameNames],
  );
  const liveSummary = useMemo(() => resolveLiveIndexerSummary(liveIndexers), [liveIndexers]);
  const hasSelectedGames = selectedGameNames.length > 0;
  const canLoadIndexers = normalizedAdminSecret.length > 0 && !isBusy;
  const canRunSelectionActions = canLoadIndexers && hasSelectedGames;

  useEffect(() => {
    setSelectedGameNames((currentGameNames) =>
      currentGameNames.filter((gameName) => availableGameNames.includes(gameName)),
    );
  }, [availableGameNames]);

  useEffect(() => {
    const autoLoadKey = `${environmentLabel}:${normalizedAdminSecret}`;

    if (!hasStoredSecret || !normalizedAdminSecret || isBusy || autoLoadedSecretKeyRef.current === autoLoadKey) {
      return;
    }

    autoLoadedSecretKeyRef.current = autoLoadKey;
    void onLoadLiveIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: [],
    });
  }, [environmentLabel, hasStoredSecret, isBusy, normalizedAdminSecret, onLoadLiveIndexers]);

  return (
    <article className="w-full md:mx-auto md:max-w-lg">
      <div className="space-y-3 pb-24 md:space-y-4 md:pb-0">
        <FactoryV2ManageIndexersOverviewCard
          environmentLabel={environmentLabel}
          liveSummary={liveSummary}
          liveIndexersUpdatedAt={liveIndexersUpdatedAt}
          notice={notice}
          adminSecret={adminSecret}
          hasStoredSecret={hasStoredSecret}
          canLoadIndexers={canLoadIndexers}
          isBusy={isBusy}
          lookupNamesText={lookupNamesText}
          lookupGameNames={lookupGameNames}
          showsLookupPanel={showsLookupPanel}
          onChangeSecret={setAdminSecret}
          onSaveSecret={() => {
            const didSave = writeFactoryV2AdminSecret(normalizedAdminSecret);
            if (didSave) {
              setHasStoredSecret(normalizedAdminSecret.length > 0);
            }
          }}
          onClearSecret={() => {
            clearFactoryV2AdminSecret();
            setAdminSecret("");
            setHasStoredSecret(false);
            autoLoadedSecretKeyRef.current = null;
          }}
          onLoadIndexers={() => {
            void onLoadLiveIndexers({
              adminSecret: normalizedAdminSecret,
              gameNames: lookupGameNames,
            });
          }}
          onRefreshIndexers={() => {
            void onRefreshLiveIndexers({
              adminSecret: normalizedAdminSecret,
              gameNames: lookupGameNames,
            });
          }}
          onToggleLookupPanel={() => setShowsLookupPanel((currentValue) => !currentValue)}
          onChangeLookupNames={setLookupNamesText}
        />

        <FactoryV2ManageIndexersSelectionCard
          liveIndexers={liveIndexers}
          selectedGameNames={selectedGameNames}
          isBusy={isBusy}
          onSelectAll={() => setSelectedGameNames(availableGameNames)}
          onClearSelection={() => setSelectedGameNames([])}
          onToggleGameName={(gameName) => {
            setSelectedGameNames((currentGameNames) =>
              currentGameNames.includes(gameName)
                ? currentGameNames.filter((currentGameName) => currentGameName !== gameName)
                : [...currentGameNames, gameName],
            );
          }}
        />

        <FactoryV2ManageIndexersActionBar
          selectedLiveIndexers={selectedLiveIndexers}
          canRunSelectionActions={canRunSelectionActions}
          hasSecret={normalizedAdminSecret.length > 0}
          isBusy={isBusy}
          onCreateIndexers={() => {
            void onCreateIndexers({
              adminSecret: normalizedAdminSecret,
              gameNames: selectedGameNames,
            });
          }}
          onDeleteIndexers={() => {
            void onDeleteIndexers({
              adminSecret: normalizedAdminSecret,
              gameNames: selectedGameNames,
            });
          }}
          onUpdateTier={(tier) => {
            void onUpdateIndexerTier({
              adminSecret: normalizedAdminSecret,
              gameNames: selectedGameNames,
              tier,
            });
          }}
        />
      </div>
    </article>
  );
};

const FactoryV2ManageIndexersOverviewCard = ({
  environmentLabel,
  liveSummary,
  liveIndexersUpdatedAt,
  notice,
  adminSecret,
  hasStoredSecret,
  canLoadIndexers,
  isBusy,
  lookupNamesText,
  lookupGameNames,
  showsLookupPanel,
  onChangeSecret,
  onSaveSecret,
  onClearSecret,
  onLoadIndexers,
  onRefreshIndexers,
  onToggleLookupPanel,
  onChangeLookupNames,
}: {
  environmentLabel: string;
  liveSummary: ReturnType<typeof resolveLiveIndexerSummary>;
  liveIndexersUpdatedAt: string | null;
  notice: string | null;
  adminSecret: string;
  hasStoredSecret: boolean;
  canLoadIndexers: boolean;
  isBusy: boolean;
  lookupNamesText: string;
  lookupGameNames: string[];
  showsLookupPanel: boolean;
  onChangeSecret: (value: string) => void;
  onSaveSecret: () => void;
  onClearSecret: () => void;
  onLoadIndexers: () => void;
  onRefreshIndexers: () => void;
  onToggleLookupPanel: () => void;
  onChangeLookupNames: (value: string) => void;
}) => (
  <section className={PRIMARY_CARD_CLASS_NAME}>
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Manage indexers</div>
        <h2 className="text-[1.35rem] font-semibold leading-8 text-black/84">
          Refresh the live list, tap the games, choose one action.
        </h2>
        <p className="text-[13px] leading-5 text-black/58">
          Most admins only need the saved secret and{" "}
          <span className="font-semibold text-black/68">Refresh from Slot</span>. Only type names manually when a game
          is missing from the list below.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <FactoryV2IndexerMetric label="Environment" value={environmentLabel} />
        <FactoryV2IndexerMetric label="Shown" value={String(liveSummary.total)} />
        <FactoryV2IndexerMetric label="Live" value={String(liveSummary.existing)} />
        <FactoryV2IndexerMetric label="Missing" value={String(liveSummary.missing)} />
        <FactoryV2IndexerMetric
          label="Last snapshot"
          value={liveIndexersUpdatedAt ? formatIndexerTimestamp(liveIndexersUpdatedAt) : "Not loaded yet"}
        />
      </div>

      {notice ? (
        <div className="rounded-[20px] border border-black/8 bg-white/74 px-4 py-3 text-sm leading-6 text-black/62">
          {notice}
        </div>
      ) : null}

      <div className="rounded-[24px] border border-black/8 bg-white/74 p-4">
        <div className="space-y-3">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">Admin secret</span>
            <input
              data-testid="factory-indexer-admin-secret"
              type="password"
              value={adminSecret}
              onChange={(event) => onChangeSecret(event.target.value)}
              placeholder="Enter once, reuse for every indexer action"
              className="block h-11 w-full rounded-[18px] border border-black/10 bg-white px-4 text-sm text-black outline-none transition-colors focus:border-black/22"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <button
              type="button"
              data-testid="factory-indexer-load"
              disabled={!canLoadIndexers}
              onClick={onLoadIndexers}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-white px-4 text-sm font-semibold text-black/72 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load current list
            </button>
            <button
              type="button"
              data-testid="factory-indexer-refresh"
              disabled={!canLoadIndexers}
              onClick={onRefreshIndexers}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#7a4b22]/15 bg-[#7a4b22] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6d411c] disabled:cursor-not-allowed disabled:bg-[#7a4b22]/45"
            >
              Refresh from Slot
            </button>
            <button
              type="button"
              data-testid="factory-indexer-open-lookup"
              disabled={isBusy}
              onClick={onToggleLookupPanel}
              className="inline-flex h-11 items-center justify-center rounded-full border border-black/10 bg-[#f6efe6] px-4 text-sm font-semibold text-black/64 transition-colors hover:bg-[#efe4d8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {showsLookupPanel ? "Hide manual lookup" : "Find missing game"}
            </button>
          </div>

          {showsLookupPanel ? (
            <div className="space-y-2 rounded-[20px] border border-black/8 bg-[#fff8f1] p-3">
              <label className="space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">
                  Names to check from Slot
                </span>
                <textarea
                  data-testid="factory-indexer-lookup-names"
                  value={lookupNamesText}
                  onChange={(event) => onChangeLookupNames(event.target.value)}
                  placeholder={"Only use this if a game is missing.\nExample:\nbltz-franky-01\nbltz-franky-02"}
                  rows={3}
                  className="block min-h-[88px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/22"
                />
              </label>
              <div className="text-xs leading-5 text-black/52">
                {lookupGameNames.length > 0
                  ? `The next load or refresh will also check ${lookupGameNames.length} typed ${
                      lookupGameNames.length === 1 ? "name" : "names"
                    }.`
                  : "Leave this empty unless a game is missing from the list."}
              </div>
            </div>
          ) : null}

          <div
            data-testid="factory-indexer-admin-status"
            className="rounded-[18px] border border-black/8 bg-white/76 px-4 py-3 text-sm text-black/60"
          >
            {hasStoredSecret
              ? "Saved on this browser. Every action uses the value currently in the field, so you can replace it anytime."
              : "Not saved yet. You can still use the current value right now, or save it once for faster admin work."}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="factory-indexer-admin-save"
              disabled={isBusy || adminSecret.trim().length === 0}
              onClick={onSaveSecret}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/66 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {hasStoredSecret ? "Update saved secret" : "Save on this browser"}
            </button>
            <button
              type="button"
              data-testid="factory-indexer-admin-clear"
              disabled={isBusy || !hasStoredSecret}
              onClick={onClearSecret}
              className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold text-black/56 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Forget saved secret
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

const FactoryV2ManageIndexersSelectionCard = ({
  liveIndexers,
  selectedGameNames,
  isBusy,
  onSelectAll,
  onClearSelection,
  onToggleGameName,
}: {
  liveIndexers: FactoryWorkerLiveIndexerEntry[];
  selectedGameNames: string[];
  isBusy: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleGameName: (gameName: string) => void;
}) => (
  <section className={QUIET_CARD_CLASS_NAME}>
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Choose games</div>
        <h3 className="text-lg font-semibold text-black/82">Tap the indexers you want to manage.</h3>
        <p className="text-[13px] leading-5 text-black/56">
          The action bar below always uses the games selected here. Nothing else needs to be typed for normal admin
          work.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FactoryV2IndexerMetric label="Selected" value={String(selectedGameNames.length)} />
        <button
          type="button"
          data-testid="factory-indexer-select-all"
          disabled={isBusy || liveIndexers.length === 0}
          onClick={onSelectAll}
          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Select all shown
        </button>
        <button
          type="button"
          data-testid="factory-indexer-clear-selection"
          disabled={isBusy || selectedGameNames.length === 0}
          onClick={onClearSelection}
          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear selection
        </button>
      </div>

      <div className="grid gap-2.5">
        {liveIndexers.length > 0 ? (
          liveIndexers.map((entry) => (
            <FactoryV2IndexerRow
              key={entry.gameName}
              entry={entry}
              isSelected={selectedGameNames.includes(entry.gameName)}
              onToggle={() => onToggleGameName(entry.gameName)}
            />
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-black/10 bg-white/72 px-4 py-8 text-center text-sm leading-6 text-black/54">
            No indexers are shown yet. Load the current list or refresh from Slot first.
          </div>
        )}
      </div>
    </div>
  </section>
);

const FactoryV2IndexerRow = ({
  entry,
  isSelected,
  onToggle,
}: {
  entry: FactoryWorkerLiveIndexerEntry;
  isSelected: boolean;
  onToggle: () => void;
}) => {
  const statusTone = resolveLiveIndexerTone(entry);

  return (
    <button
      type="button"
      data-testid={`factory-indexer-select-${entry.gameName}`}
      onClick={onToggle}
      className={cn(
        "w-full rounded-[22px] border px-4 py-4 text-left transition-all duration-200",
        isSelected
          ? "border-[#7a4b22]/18 bg-[#fff6eb] shadow-[0_12px_28px_rgba(122,75,34,0.08)]"
          : "border-black/8 bg-white/78 hover:bg-white",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
            isSelected ? "border-[#7a4b22] bg-[#7a4b22] text-white" : "border-black/12 bg-white text-transparent",
          )}
        >
          ✓
        </span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-black/82">{entry.gameName}</span>
            <FactoryV2IndexerStateBadge label={resolveLiveIndexerPrimaryBadge(entry)} tone={statusTone} />
          </div>
          <div className="text-[12px] leading-5 text-black/56">{resolveLiveIndexerStatusLabel(entry)}</div>
          <div className="flex flex-wrap gap-2">
            {resolveLiveIndexerDetails(entry).map((detail) => (
              <span
                key={`${entry.gameName}-${detail}`}
                className="rounded-full border border-black/8 bg-[#f7f1ea] px-2.5 py-1 text-[11px] font-medium text-black/48"
              >
                {detail}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
};

const FactoryV2ManageIndexersActionBar = ({
  selectedLiveIndexers,
  canRunSelectionActions,
  hasSecret,
  isBusy,
  onCreateIndexers,
  onDeleteIndexers,
  onUpdateTier,
}: {
  selectedLiveIndexers: FactoryWorkerLiveIndexerEntry[];
  canRunSelectionActions: boolean;
  hasSecret: boolean;
  isBusy: boolean;
  onCreateIndexers: () => void;
  onDeleteIndexers: () => void;
  onUpdateTier: (tier: FactoryWorkerIndexerTier) => void;
}) => (
  <section className={ACTION_BAR_CLASS_NAME}>
    <div className="space-y-1 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7a4b22]/72">Choose one action</div>
      <h3 className="text-lg font-semibold text-black/82">
        {selectedLiveIndexers.length > 0
          ? `${selectedLiveIndexers.length} indexer${selectedLiveIndexers.length === 1 ? "" : "s"} selected`
          : "Select games above first"}
      </h3>
      <p className="text-[13px] leading-5 text-black/56">
        Recreate them, move them to a new tier, or delete them. Every action uses the current selection only.
      </p>
    </div>

    {selectedLiveIndexers.length > 0 ? (
      <div className="flex flex-wrap justify-center gap-2">
        {resolveSelectionPreviewLabels(selectedLiveIndexers).map((label) => (
          <span
            key={label}
            className="rounded-full border border-black/10 bg-white/76 px-3 py-1.5 text-xs font-semibold text-black/60"
          >
            {label}
          </span>
        ))}
      </div>
    ) : (
      <div className="rounded-[20px] border border-dashed border-black/10 bg-white/72 px-4 py-4 text-center text-sm text-black/54">
        Tap one or more games in the list above to unlock actions here.
      </div>
    )}

    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        data-testid="factory-indexer-action-create"
        disabled={!canRunSelectionActions}
        onClick={onCreateIndexers}
        className="inline-flex h-11 items-center justify-center rounded-full border border-[#7a4b22]/15 bg-[#7a4b22] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#6d411c] disabled:cursor-not-allowed disabled:bg-[#7a4b22]/45"
      >
        Recreate selected indexers
      </button>
      <button
        type="button"
        data-testid="factory-indexer-action-delete"
        disabled={!canRunSelectionActions}
        onClick={onDeleteIndexers}
        className="inline-flex h-11 items-center justify-center rounded-full border border-[#a62f28]/15 bg-[#a62f28] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#92261f] disabled:cursor-not-allowed disabled:bg-[#a62f28]/45"
      >
        Delete selected indexers
      </button>
    </div>

    <div className="space-y-2">
      <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">
        Move selected indexers to
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {INDEXER_TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            data-testid={`factory-indexer-action-${tier}`}
            disabled={!canRunSelectionActions}
            onClick={() => onUpdateTier(tier)}
            className="rounded-[18px] border border-black/10 bg-white/82 px-3 py-3 text-sm font-semibold capitalize text-black/68 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {tier}
          </button>
        ))}
      </div>
    </div>

    <div className="rounded-[18px] border border-black/8 bg-white/72 px-4 py-3 text-sm text-black/58">
      {isBusy
        ? "One indexer action is already running. Wait for it to finish before starting another."
        : hasSecret
          ? "Ready when you are. The current field value is the secret that will be used."
          : "Add the admin secret above to unlock indexer actions."}
    </div>
  </section>
);

const FactoryV2IndexerMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-full border border-black/8 bg-white/80 px-3 py-1.5 text-xs font-semibold text-black/54">
    <span className="text-black/38">{label}: </span>
    {value}
  </div>
);

const FactoryV2IndexerStateBadge = ({ label, tone }: { label: string; tone: "neutral" | "warm" | "danger" }) => (
  <span
    className={cn(
      "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
      tone === "warm" && "border-[#7a4b22]/15 bg-[#f7ecdf] text-[#7a4b22]",
      tone === "danger" && "border-[#a62f28]/15 bg-[#f9ecea] text-[#a62f28]",
      tone === "neutral" && "border-black/10 bg-white/80 text-black/52",
    )}
  >
    {label}
  </span>
);

function parseIndexerGameNames(value: string) {
  const seenGameNames = new Set<string>();
  const orderedGameNames: string[] = [];

  value
    .split(/[\n,]+/)
    .map((gameName) => gameName.trim())
    .filter(Boolean)
    .forEach((gameName) => {
      if (seenGameNames.has(gameName)) {
        return;
      }

      seenGameNames.add(gameName);
      orderedGameNames.push(gameName);
    });

  return orderedGameNames;
}

function resolveLiveIndexerSummary(entries: FactoryWorkerLiveIndexerEntry[]) {
  return entries.reduce(
    (summary, entry) => {
      summary.total += 1;

      if (entry.liveState.state === "existing") {
        summary.existing += 1;
        return summary;
      }

      if (entry.liveState.state === "missing") {
        summary.missing += 1;
        return summary;
      }

      summary.indeterminate += 1;
      return summary;
    },
    {
      total: 0,
      existing: 0,
      missing: 0,
      indeterminate: 0,
    },
  );
}

function resolveLiveIndexerPrimaryBadge(entry: FactoryWorkerLiveIndexerEntry) {
  if (entry.liveState.state === "existing") {
    return entry.liveState.currentTier ?? "live";
  }

  if (entry.liveState.state === "missing") {
    return "missing";
  }

  return "needs check";
}

function resolveLiveIndexerTone(entry: FactoryWorkerLiveIndexerEntry) {
  if (entry.liveState.state === "missing") {
    return "danger";
  }

  if (entry.liveState.state === "indeterminate") {
    return "warm";
  }

  return "neutral";
}

function resolveLiveIndexerStatusLabel(entry: FactoryWorkerLiveIndexerEntry) {
  if (entry.liveState.state === "existing") {
    return entry.liveState.url
      ? "Live deployment found and ready for admin actions."
      : "Live deployment found in Slot.";
  }

  if (entry.liveState.state === "missing") {
    return "No torii deployment was found in Slot. Recreate it if this game should be live.";
  }

  return "Slot could not confirm the live deployment cleanly. Refresh it before changing tier or deleting.";
}

function resolveLiveIndexerDetails(entry: FactoryWorkerLiveIndexerEntry) {
  const details = [
    entry.liveState.branch ? `Branch ${entry.liveState.branch}` : null,
    entry.liveState.version ? `Version ${entry.liveState.version}` : null,
    entry.liveState.url ? "URL available" : null,
    resolveLiveIndexerSourceLabel(entry),
  ].filter(Boolean);

  return details.length > 0 ? details : ["No extra live details yet"];
}

function resolveLiveIndexerSourceLabel(entry: FactoryWorkerLiveIndexerEntry) {
  switch (entry.liveState.stateSource) {
    case "describe":
      return "Checked with describe";
    case "describe-not-found":
      return "Checked with describe";
    case "list":
      return "Checked with list";
    case "describe-and-list-failed":
      return "Both Slot checks failed";
  }
}

function resolveSelectionPreviewLabels(entries: FactoryWorkerLiveIndexerEntry[]) {
  const labels = entries.slice(0, 3).map((entry) => entry.gameName);

  if (entries.length > 3) {
    labels.push(`+${entries.length - 3} more`);
  }

  return labels;
}

function formatIndexerTimestamp(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
