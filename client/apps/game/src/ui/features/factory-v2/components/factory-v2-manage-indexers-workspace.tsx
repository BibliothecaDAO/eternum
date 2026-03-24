import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { FactoryWorkerIndexerTier, FactoryWorkerLiveIndexerEntry } from "../api/factory-worker";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryGameMode, FactoryWatcherKind, FactoryWatcherState } from "../types";

interface FactoryV2ManageIndexersWorkspaceProps {
  mode: FactoryGameMode;
  watcher: FactoryWatcherState | null;
  adminSecret: string;
  hasSavedAdminSecret: boolean;
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

type FactoryManageIndexerFilter = "all" | "live" | "missing" | "needs-check";
type FactoryManageIndexerAction = "create" | "tier" | "delete";

const INDEXER_TIERS: FactoryWorkerIndexerTier[] = ["basic", "pro", "legendary", "epic"];
const INDEXER_MANAGE_WATCHER_KINDS: FactoryWatcherKind[] = [
  "refresh_live_indexers",
  "create_indexers",
  "update_indexer_tier",
  "delete_indexers",
];

export const FactoryV2ManageIndexersWorkspace = ({
  mode,
  watcher,
  adminSecret,
  hasSavedAdminSecret,
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
  const appearance = resolveFactoryModeAppearance(mode);
  const [lookupNamesText, setLookupNamesText] = useState("");
  const [showsLookupPanel, setShowsLookupPanel] = useState(false);
  const [selectedGameNames, setSelectedGameNames] = useState<string[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FactoryManageIndexerFilter>("all");
  const [selectedAction, setSelectedAction] = useState<FactoryManageIndexerAction>("create");
  const [selectedTier, setSelectedTier] = useState<FactoryWorkerIndexerTier>("pro");
  const [showsDeletePanel, setShowsDeletePanel] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const autoLoadedSecretKeyRef = useRef<string | null>(null);

  const normalizedAdminSecret = adminSecret.trim();
  const lookupGameNames = useMemo(() => parseIndexerGameNames(lookupNamesText), [lookupNamesText]);
  const availableGameNames = useMemo(() => liveIndexers.map((entry) => entry.gameName), [liveIndexers]);
  const filteredLiveIndexers = useMemo(
    () => filterLiveIndexers(liveIndexers, selectedFilter),
    [liveIndexers, selectedFilter],
  );
  const filteredGameNames = useMemo(() => filteredLiveIndexers.map((entry) => entry.gameName), [filteredLiveIndexers]);
  const selectedLiveIndexers = useMemo(
    () => liveIndexers.filter((entry) => selectedGameNames.includes(entry.gameName)),
    [liveIndexers, selectedGameNames],
  );
  const liveSummary = useMemo(() => resolveLiveIndexerSummary(liveIndexers), [liveIndexers]);
  const watcherStatus = useMemo(() => resolveManageIndexerWatcherStatus(watcher), [watcher]);

  const hasSelectedGames = selectedGameNames.length > 0;
  const hasSecret = normalizedAdminSecret.length > 0;
  const hasLoadedLiveIndexers = liveIndexersUpdatedAt !== null || liveIndexers.length > 0;
  const canLoadIndexers = hasSecret && !isBusy;
  const canRunSelectionActions = canLoadIndexers && hasSelectedGames;
  const accessWatcherStatus = watcher?.kind === "refresh_live_indexers" ? watcherStatus : null;
  const actionWatcherStatus = watcher?.kind && watcher.kind !== "refresh_live_indexers" ? watcherStatus : null;
  const showsGamesSection = hasLoadedLiveIndexers;
  const showsActionSection = hasSelectedGames || Boolean(actionWatcherStatus);
  const selectedActionState = resolveManageIndexerActionState({
    selectedAction,
    selectedTier,
    selectedCount: selectedGameNames.length,
    canRunSelectionActions,
    deleteConfirmed,
  });

  useEffect(() => {
    setSelectedGameNames((currentGameNames) =>
      currentGameNames.filter((gameName) => availableGameNames.includes(gameName)),
    );
  }, [availableGameNames]);

  useEffect(() => {
    if (!showsDeletePanel) {
      return;
    }

    setDeleteConfirmed(false);
  }, [selectedGameNames, showsDeletePanel]);

  useEffect(() => {
    if (hasSavedAdminSecret) {
      return;
    }

    autoLoadedSecretKeyRef.current = null;
  }, [hasSavedAdminSecret]);

  useEffect(() => {
    const autoLoadKey = `${environmentLabel}:${normalizedAdminSecret}`;

    if (!hasSavedAdminSecret || !normalizedAdminSecret || isBusy || autoLoadedSecretKeyRef.current === autoLoadKey) {
      return;
    }

    autoLoadedSecretKeyRef.current = autoLoadKey;
    void onLoadLiveIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: [],
    });
  }, [environmentLabel, hasSavedAdminSecret, isBusy, normalizedAdminSecret, onLoadLiveIndexers]);

  const selectAction = (nextAction: FactoryManageIndexerAction) => {
    setSelectedAction(nextAction);

    if (nextAction !== "delete") {
      setShowsDeletePanel(false);
      setDeleteConfirmed(false);
    }
  };

  const toggleDeletePanel = () => {
    const nextOpen = !showsDeletePanel;

    setShowsDeletePanel(nextOpen);
    setDeleteConfirmed(false);
    setSelectedAction(nextOpen ? "delete" : "create");
  };

  const submitSelectedAction = () => {
    if (!selectedActionState.canSubmit) {
      return;
    }

    switch (selectedActionState.kind) {
      case "create":
        void onCreateIndexers({
          adminSecret: normalizedAdminSecret,
          gameNames: selectedGameNames,
        });
        return;
      case "tier":
        void onUpdateIndexerTier({
          adminSecret: normalizedAdminSecret,
          gameNames: selectedGameNames,
          tier: selectedActionState.selectedTier,
        });
        return;
      case "delete":
        void onDeleteIndexers({
          adminSecret: normalizedAdminSecret,
          gameNames: selectedGameNames,
        });
        return;
    }
  };

  return (
    <article className="w-full md:mx-auto md:max-w-lg">
      <div className={cn("px-0 py-0 md:rounded-[28px] md:border md:px-7 md:py-8", appearance.featureSurfaceClassName)}>
        <div className={cn("space-y-3 md:space-y-4 md:pb-0", showsActionSection ? "pb-24" : "pb-0")}>
          <FactoryV2ManageIndexersSectionCard title="Access" appearanceClassName={appearance.quietSurfaceClassName}>
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  data-testid="factory-indexer-refresh"
                  disabled={!canLoadIndexers}
                  onClick={() => {
                    void onRefreshLiveIndexers({
                      adminSecret: normalizedAdminSecret,
                      gameNames: lookupGameNames,
                    });
                  }}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    appearance.primaryButtonClassName,
                  )}
                >
                  Refresh from Slot
                </button>
                <button
                  type="button"
                  data-testid="factory-indexer-load"
                  disabled={!canLoadIndexers}
                  onClick={() => {
                    void onLoadLiveIndexers({
                      adminSecret: normalizedAdminSecret,
                      gameNames: lookupGameNames,
                    });
                  }}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    appearance.secondaryButtonClassName,
                  )}
                >
                  Load current list
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="factory-indexer-open-lookup"
                  disabled={isBusy}
                  onClick={() => setShowsLookupPanel((currentValue) => !currentValue)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-black/64 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Missing a game
                  <ChevronDown
                    className={cn("h-4 w-4 transition-transform", showsLookupPanel ? "rotate-180" : "rotate-0")}
                  />
                </button>
              </div>

              {showsLookupPanel ? (
                <div className="space-y-2 rounded-[20px] border border-black/8 bg-[#fff8f1] p-3">
                  <label className="block">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">
                      Names to check from Slot
                    </span>
                    <textarea
                      data-testid="factory-indexer-lookup-names"
                      value={lookupNamesText}
                      onChange={(event) => setLookupNamesText(event.target.value)}
                      placeholder={"bltz-franky-01\nbltz-franky-02"}
                      rows={3}
                      className="mt-2 block min-h-[88px] w-full rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm text-black outline-none transition-colors focus:border-black/22"
                    />
                  </label>
                  {lookupGameNames.length > 0 ? (
                    <div className="text-xs leading-5 text-black/52">
                      Checking {lookupGameNames.length} typed {lookupGameNames.length === 1 ? "name" : "names"}.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {hasLoadedLiveIndexers ? (
                <div className="text-xs font-medium text-black/52">
                  {resolveLiveIndexerSnapshotStatusLine({
                    environmentLabel,
                    liveSummary,
                    liveIndexersUpdatedAt,
                  })}
                </div>
              ) : null}

              {accessWatcherStatus ? <FactoryV2ManageIndexerWatcherCard watcherStatus={accessWatcherStatus} /> : null}

              {notice ? (
                <div className="rounded-[18px] border border-black/8 bg-white/74 px-4 py-3 text-sm text-black/62">
                  {notice}
                </div>
              ) : null}
            </div>
          </FactoryV2ManageIndexersSectionCard>

          {showsGamesSection ? (
            <FactoryV2ManageIndexersSectionCard title="Games" appearanceClassName={appearance.quietSurfaceClassName}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-black/76">
                    {hasSelectedGames ? `${selectedGameNames.length} selected` : `${filteredLiveIndexers.length} shown`}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {filteredGameNames.length > 1 ? (
                      <button
                        type="button"
                        data-testid="factory-indexer-select-all"
                        disabled={isBusy || filteredGameNames.length === 0}
                        onClick={() => setSelectedGameNames(filteredGameNames)}
                        className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Select all
                      </button>
                    ) : null}
                    {selectedGameNames.length > 0 ? (
                      <button
                        type="button"
                        data-testid="factory-indexer-clear-selection"
                        disabled={isBusy || selectedGameNames.length === 0}
                        onClick={() => setSelectedGameNames([])}
                        className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["all", "All"],
                      ["live", "Live"],
                      ["missing", "Missing"],
                      ["needs-check", "Check"],
                    ] as Array<[FactoryManageIndexerFilter, string]>
                  ).map(([filter, label]) => (
                    <button
                      key={filter}
                      type="button"
                      data-testid={`factory-indexer-filter-${filter}`}
                      disabled={isBusy}
                      onClick={() => setSelectedFilter(filter)}
                      className={cn(
                        "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                        selectedFilter === filter
                          ? appearance.activeToggleClassName
                          : appearance.secondaryButtonClassName,
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="grid gap-2.5">
                  {liveIndexers.length === 0 ? (
                    <FactoryV2IndexerEmptyState>No indexers in this snapshot.</FactoryV2IndexerEmptyState>
                  ) : filteredLiveIndexers.length === 0 ? (
                    <FactoryV2IndexerEmptyState>
                      No {resolveFilterEmptyStateLabel(selectedFilter)} indexers.
                    </FactoryV2IndexerEmptyState>
                  ) : (
                    filteredLiveIndexers.map((entry) => (
                      <FactoryV2IndexerRow
                        key={entry.gameName}
                        entry={entry}
                        disabled={isBusy}
                        isSelected={selectedGameNames.includes(entry.gameName)}
                        appearanceClassName={appearance.listItemClassName}
                        onToggle={() => {
                          setSelectedGameNames((currentGameNames) =>
                            currentGameNames.includes(entry.gameName)
                              ? currentGameNames.filter((currentGameName) => currentGameName !== entry.gameName)
                              : [...currentGameNames, entry.gameName],
                          );
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            </FactoryV2ManageIndexersSectionCard>
          ) : null}

          {showsActionSection ? (
            <FactoryV2ManageIndexersActionBar
              appearance={appearance}
              selectedActionState={selectedActionState}
              selectedGameNames={selectedGameNames}
              selectedLiveIndexers={selectedLiveIndexers}
              isBusy={isBusy}
              watcherStatus={actionWatcherStatus}
              selectedAction={selectedAction}
              selectedTier={selectedTier}
              showsDeletePanel={showsDeletePanel}
              deleteConfirmed={deleteConfirmed}
              onSelectAction={selectAction}
              onSelectTier={setSelectedTier}
              onToggleDeletePanel={toggleDeletePanel}
              onConfirmDelete={() => setDeleteConfirmed(true)}
              onCancelDelete={() => {
                setShowsDeletePanel(false);
                setDeleteConfirmed(false);
                setSelectedAction("create");
              }}
              onSubmit={submitSelectedAction}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
};

const FactoryV2ManageIndexersSectionCard = ({
  title,
  description,
  appearanceClassName,
  children,
}: {
  title: string;
  description?: string;
  appearanceClassName: string;
  children: ReactNode;
}) => (
  <section
    className={cn(
      "space-y-3 rounded-[24px] border border-black/8 px-4 py-4 text-left sm:px-5 sm:py-5",
      appearanceClassName,
    )}
  >
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">{title}</div>
      {description ? <p className="text-sm leading-5 text-black/50">{description}</p> : null}
    </div>
    {children}
  </section>
);

const FactoryV2ManageIndexersActionBar = ({
  appearance,
  selectedActionState,
  selectedGameNames,
  selectedLiveIndexers,
  isBusy,
  watcherStatus,
  selectedAction,
  selectedTier,
  showsDeletePanel,
  deleteConfirmed,
  onSelectAction,
  onSelectTier,
  onToggleDeletePanel,
  onConfirmDelete,
  onCancelDelete,
  onSubmit,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  selectedActionState: ReturnType<typeof resolveManageIndexerActionState>;
  selectedGameNames: string[];
  selectedLiveIndexers: FactoryWorkerLiveIndexerEntry[];
  isBusy: boolean;
  watcherStatus: ReturnType<typeof resolveManageIndexerWatcherStatus>;
  selectedAction: FactoryManageIndexerAction;
  selectedTier: FactoryWorkerIndexerTier;
  showsDeletePanel: boolean;
  deleteConfirmed: boolean;
  onSelectAction: (nextAction: FactoryManageIndexerAction) => void;
  onSelectTier: (tier: FactoryWorkerIndexerTier) => void;
  onToggleDeletePanel: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onSubmit: () => void;
}) => {
  const hasSelectedGames = selectedGameNames.length > 0;

  return (
    <div
      className={cn(
        "sticky bottom-3 z-10 space-y-3 rounded-[24px] border border-black/10 px-4 pb-[calc(0.875rem+env(safe-area-inset-bottom))] pt-4 text-left shadow-[0_18px_42px_rgba(23,15,8,0.16)] backdrop-blur-xl md:static md:rounded-[22px] md:border-black/8 md:px-4 md:py-4 md:shadow-none md:backdrop-blur-0",
        appearance.quietSurfaceClassName,
      )}
    >
      {hasSelectedGames ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/42">Action</div>
            <div className="text-sm font-semibold text-black/78">
              {selectedGameNames.length} indexer{selectedGameNames.length === 1 ? "" : "s"} selected
            </div>
          </div>

          {selectedLiveIndexers.length > 0 ? (
            <div className="text-sm leading-6 text-black/56">{resolveSelectionPreviewText(selectedLiveIndexers)}</div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              data-testid="factory-indexer-mode-create"
              disabled={isBusy}
              onClick={() => onSelectAction("create")}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-[18px] px-4 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                selectedAction === "create" ? appearance.activeToggleClassName : appearance.secondaryButtonClassName,
              )}
            >
              Recreate
            </button>
            <button
              type="button"
              data-testid="factory-indexer-mode-tier"
              disabled={isBusy}
              onClick={() => onSelectAction("tier")}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-[18px] px-4 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                selectedAction === "tier" ? appearance.activeToggleClassName : appearance.secondaryButtonClassName,
              )}
            >
              Change tier
            </button>
          </div>

          {selectedAction === "tier" ? (
            <div className="rounded-[20px] border border-black/8 bg-white/64 p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {INDEXER_TIERS.map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    data-testid={`factory-indexer-action-${tier}`}
                    disabled={isBusy}
                    onClick={() => onSelectTier(tier)}
                    className={cn(
                      "rounded-[18px] border px-3 py-3 text-sm font-semibold capitalize transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      selectedTier === tier
                        ? "border-black/16 bg-[rgba(255,252,247,0.82)] text-[#1b140f] shadow-[0_8px_20px_rgba(44,28,15,0.08)]"
                        : "border-black/10 bg-white/82 text-black/68 hover:bg-white",
                    )}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[20px] border border-black/8 bg-white/64 p-3">
            {!showsDeletePanel ? (
              <button
                type="button"
                data-testid="factory-indexer-open-delete"
                disabled={isBusy}
                onClick={onToggleDeletePanel}
                className="inline-flex w-full items-center justify-center rounded-full border border-[#a62f28]/20 bg-[#fff8f7] px-4 py-3 text-sm font-semibold text-[#8d2a23] transition-colors hover:bg-[#fff1ee] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete indexers
              </button>
            ) : (
              <div className="space-y-3">
                <div className="text-sm leading-6 text-[#8d2a23]/82">
                  Delete removes the live Slot deployment for the current selection.
                </div>

                {deleteConfirmed ? (
                  <div className="rounded-[18px] border border-[#a62f28]/18 bg-[#fff1ee] px-4 py-3 text-sm text-[#8d2a23]/82">
                    Delete is armed for the current selection only.
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid="factory-indexer-confirm-delete"
                    disabled={!selectedActionState.canBaseAction}
                    onClick={onConfirmDelete}
                    className="inline-flex w-full items-center justify-center rounded-full border border-[#a62f28]/20 bg-white px-4 py-3 text-sm font-semibold text-[#8d2a23] transition-colors hover:bg-[#fff8f7] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    I understand, enable delete
                  </button>
                )}

                <button
                  type="button"
                  data-testid="factory-indexer-cancel-delete"
                  disabled={isBusy}
                  onClick={onCancelDelete}
                  className="inline-flex w-full items-center justify-center rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Keep these indexers
                </button>
              </div>
            )}
          </div>
        </>
      ) : null}

      {watcherStatus ? <FactoryV2ManageIndexerWatcherCard watcherStatus={watcherStatus} /> : null}

      {hasSelectedGames && selectedActionState.kind === "create" ? (
        <button
          type="button"
          data-testid="factory-indexer-action-create"
          disabled={!selectedActionState.canSubmit}
          onClick={onSubmit}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            appearance.primaryButtonClassName,
          )}
        >
          {selectedActionState.submitLabel}
        </button>
      ) : null}

      {hasSelectedGames && selectedActionState.kind === "tier" ? (
        <button
          type="button"
          data-testid="factory-indexer-action-update-tier"
          disabled={!selectedActionState.canSubmit}
          onClick={onSubmit}
          className={cn(
            "inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            appearance.primaryButtonClassName,
          )}
        >
          {selectedActionState.submitLabel}
        </button>
      ) : null}

      {hasSelectedGames && selectedActionState.kind === "delete" && deleteConfirmed ? (
        <button
          type="button"
          data-testid="factory-indexer-action-delete"
          disabled={!selectedActionState.canSubmit}
          onClick={onSubmit}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#a62f28] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#92261f] disabled:cursor-not-allowed disabled:bg-[#a62f28]/45"
        >
          {selectedActionState.submitLabel}
        </button>
      ) : null}
    </div>
  );
};

const FactoryV2IndexerRow = ({
  entry,
  disabled,
  isSelected,
  appearanceClassName,
  onToggle,
}: {
  entry: FactoryWorkerLiveIndexerEntry;
  disabled: boolean;
  isSelected: boolean;
  appearanceClassName: string;
  onToggle: () => void;
}) => {
  const tone = resolveLiveIndexerTone(entry);

  return (
    <button
      type="button"
      data-testid={`factory-indexer-select-${entry.gameName}`}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "w-full rounded-[22px] border px-4 py-4 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55",
        isSelected
          ? "border-black/14 bg-[rgba(255,252,247,0.82)] shadow-[0_12px_28px_rgba(44,28,15,0.08)]"
          : appearanceClassName,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors",
            isSelected ? "border-[#1b140f] bg-[#1b140f] text-white" : "border-black/12 bg-white text-transparent",
          )}
        >
          ✓
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-black/82">{entry.gameName}</span>
            <FactoryV2IndexerStateBadge label={resolveLiveIndexerPrimaryBadge(entry)} tone={tone} />
          </div>
          <div className="mt-1 text-[12px] leading-5 text-black/56">{resolveLiveIndexerStatusLabel(entry)}</div>
        </div>
      </div>
    </button>
  );
};

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

const FactoryV2IndexerEmptyState = ({ children }: { children: ReactNode }) => (
  <div className="rounded-[22px] border border-dashed border-black/10 bg-white/72 px-4 py-8 text-center text-sm leading-6 text-black/54">
    {children}
  </div>
);

const FactoryV2ManageIndexerWatcherCard = ({
  watcherStatus,
}: {
  watcherStatus: NonNullable<ReturnType<typeof resolveManageIndexerWatcherStatus>>;
}) => (
  <div
    data-testid="factory-indexer-watcher"
    className={cn(
      "rounded-[18px] border px-4 py-3",
      watcherStatus.tone === "warm" ? "border-[#7a4b22]/15 bg-[#f7ecdf]" : "border-black/8 bg-white/72",
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">{watcherStatus.eyebrow}</div>
    <div className="mt-1 text-sm font-semibold text-black/74">{watcherStatus.title}</div>
    <p className="mt-1 text-sm leading-6 text-black/58">{watcherStatus.detail}</p>
  </div>
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

function resolveLiveIndexerSnapshotStatusLine({
  environmentLabel,
  liveSummary,
  liveIndexersUpdatedAt,
}: {
  environmentLabel: string;
  liveSummary: ReturnType<typeof resolveLiveIndexerSummary>;
  liveIndexersUpdatedAt: string | null;
}) {
  const parts = [
    environmentLabel,
    `${liveSummary.total} shown`,
    `${liveSummary.existing} live`,
    `${liveSummary.missing} missing`,
  ];

  if (liveSummary.indeterminate > 0) {
    parts.push(`${liveSummary.indeterminate} check`);
  }

  if (liveIndexersUpdatedAt) {
    parts.push(`Updated ${formatIndexerTimestamp(liveIndexersUpdatedAt)}`);
  }

  return parts.join(" · ");
}

function filterLiveIndexers(entries: FactoryWorkerLiveIndexerEntry[], filter: FactoryManageIndexerFilter) {
  if (filter === "all") {
    return entries;
  }

  return entries.filter((entry) => {
    if (filter === "live") {
      return entry.liveState.state === "existing";
    }

    if (filter === "missing") {
      return entry.liveState.state === "missing";
    }

    return entry.liveState.state === "indeterminate";
  });
}

function resolveLiveIndexerPrimaryBadge(entry: FactoryWorkerLiveIndexerEntry) {
  if (entry.liveState.state === "existing") {
    return entry.liveState.currentTier ?? "live";
  }

  if (entry.liveState.state === "missing") {
    return "missing";
  }

  return "check";
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
    return entry.liveState.url ? "Live deployment found and ready." : "Live deployment found in Slot.";
  }

  if (entry.liveState.state === "missing") {
    return "No Slot deployment was found for this game yet.";
  }

  return "Slot could not confirm this indexer cleanly. Refresh it before changing it.";
}

function resolveSelectionPreviewText(entries: FactoryWorkerLiveIndexerEntry[]) {
  const labels = entries.slice(0, 2).map((entry) => entry.gameName);

  if (entries.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} +${entries.length - 2} more`;
}

function resolveManageIndexerActionState({
  selectedAction,
  selectedTier,
  selectedCount,
  canRunSelectionActions,
  deleteConfirmed,
}: {
  selectedAction: FactoryManageIndexerAction;
  selectedTier: FactoryWorkerIndexerTier;
  selectedCount: number;
  canRunSelectionActions: boolean;
  deleteConfirmed: boolean;
}) {
  if (selectedAction === "tier") {
    return {
      kind: "tier" as const,
      submitLabel:
        selectedCount <= 1
          ? `Move selected indexer to ${selectedTier}`
          : `Move ${selectedCount} selected indexers to ${selectedTier}`,
      selectedTier,
      canBaseAction: canRunSelectionActions,
      canSubmit: canRunSelectionActions,
    };
  }

  if (selectedAction === "delete") {
    return {
      kind: "delete" as const,
      submitLabel: selectedCount <= 1 ? "Delete selected indexer" : `Delete ${selectedCount} selected indexers`,
      canBaseAction: canRunSelectionActions,
      canSubmit: canRunSelectionActions && deleteConfirmed,
    };
  }

  return {
    kind: "create" as const,
    submitLabel: selectedCount <= 1 ? "Recreate selected indexer" : `Recreate ${selectedCount} selected indexers`,
    canBaseAction: canRunSelectionActions,
    canSubmit: canRunSelectionActions,
  };
}

function resolveManageIndexerWatcherStatus(watcher: FactoryWatcherState | null) {
  if (!watcher) {
    return null;
  }

  if (INDEXER_MANAGE_WATCHER_KINDS.includes(watcher.kind)) {
    return {
      eyebrow: watcher.statusLabel,
      title: watcher.title,
      detail: watcher.detail,
      tone: "neutral" as const,
    };
  }

  return {
    eyebrow: "Factory busy",
    title: "Another factory action is running",
    detail: watcher.detail,
    tone: "warm" as const,
  };
}

function resolveFilterEmptyStateLabel(filter: FactoryManageIndexerFilter) {
  switch (filter) {
    case "live":
      return "live";
    case "missing":
      return "missing";
    case "needs-check":
      return "needs attention";
    default:
      return "matching";
  }
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
