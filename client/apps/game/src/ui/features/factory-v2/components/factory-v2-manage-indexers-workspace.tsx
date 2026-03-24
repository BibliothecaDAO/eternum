import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import RotateCw from "lucide-react/dist/esm/icons/rotate-cw";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import type { FactoryWorkerIndexerTier, FactoryWorkerLiveIndexerEntry } from "../api/factory-worker";
import { resolveFactoryModeAppearance } from "../mode-appearance";
import type { FactoryActionFeedback, FactoryGameMode, FactoryWatcherKind, FactoryWatcherState } from "../types";

interface FactoryV2ManageIndexersWorkspaceProps {
  mode: FactoryGameMode;
  watcher: FactoryWatcherState | null;
  adminSecret: string;
  hasSavedAdminSecret: boolean;
  environmentLabel: string;
  liveIndexers: FactoryWorkerLiveIndexerEntry[];
  liveIndexersUpdatedAt: string | null;
  hasLoadedLiveIndexersSnapshot: boolean;
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
  onDeleteIndexers: (request: {
    adminSecret: string;
    gameNames: string[];
  }) => Promise<FactoryActionFeedback | null> | FactoryActionFeedback | null;
}

type FactoryManageIndexerFilter = "all" | "live" | "missing" | "needs-check";
type FactoryManageIndexerFilterOption = {
  value: FactoryManageIndexerFilter;
  label: string;
};

const INDEXER_TIERS: FactoryWorkerIndexerTier[] = ["basic", "pro", "legendary", "epic"];
const INDEXER_MANAGE_WATCHER_KINDS: FactoryWatcherKind[] = [
  "refresh_live_indexers",
  "create_indexers",
  "update_indexer_tier",
  "delete_indexers",
];
const FACTORY_INDEXER_FILTER_OPTIONS: FactoryManageIndexerFilterOption[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "missing", label: "Missing" },
  { value: "needs-check", label: "Review" },
];

export const FactoryV2ManageIndexersWorkspace = ({
  mode,
  watcher,
  adminSecret,
  environmentLabel,
  liveIndexers,
  liveIndexersUpdatedAt,
  hasLoadedLiveIndexersSnapshot,
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
  const [selectedTier, setSelectedTier] = useState<FactoryWorkerIndexerTier>("pro");
  const [showsDeletePanel, setShowsDeletePanel] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<FactoryActionFeedback | null>(null);
  const autoLoadedSecretKeyRef = useRef<string | null>(null);

  const normalizedAdminSecret = adminSecret.trim();
  const lookupGameNames = useMemo(() => parseIndexerGameNames(lookupNamesText), [lookupNamesText]);
  const availableGameNames = useMemo(() => liveIndexers.map((entry) => entry.gameName), [liveIndexers]);
  const liveSummary = useMemo(() => resolveLiveIndexerSummary(liveIndexers), [liveIndexers]);
  const filterOptions = useMemo(() => resolveAvailableManageIndexerFilters(liveSummary), [liveSummary]);
  const filteredLiveIndexers = useMemo(
    () => resolveVisibleLiveIndexers(liveIndexers, selectedFilter),
    [liveIndexers, selectedFilter],
  );
  const filteredGameNames = useMemo(() => filteredLiveIndexers.map((entry) => entry.gameName), [filteredLiveIndexers]);
  const selectedLiveIndexers = useMemo(
    () => liveIndexers.filter((entry) => selectedGameNames.includes(entry.gameName)),
    [liveIndexers, selectedGameNames],
  );
  const actionTargets = useMemo(
    () => resolveSelectedIndexerActionTargets(selectedLiveIndexers),
    [selectedLiveIndexers],
  );
  const watcherStatus = useMemo(() => resolveManageIndexerWatcherStatus(watcher), [watcher]);

  const hasSelectedGames = selectedGameNames.length > 0;
  const hasSecret = normalizedAdminSecret.length > 0;
  const hasLoadedLiveIndexers =
    hasLoadedLiveIndexersSnapshot || liveIndexersUpdatedAt !== null || liveIndexers.length > 0;
  const canLoadIndexers = hasSecret && !isBusy;
  const canRecreateTypedNames = canLoadIndexers && lookupGameNames.length > 0;
  const canRecreateSelected = canLoadIndexers && actionTargets.recreatableGameNames.length > 0;
  const canUpdateSelected = canLoadIndexers && actionTargets.updatableGameNames.length > 0;
  const canDeleteSelected = canLoadIndexers && actionTargets.deletableGameNames.length > 0;
  const accessWatcherStatus = watcher?.kind === "refresh_live_indexers" ? watcherStatus : null;
  const actionWatcherStatus = watcher?.kind && watcher.kind !== "refresh_live_indexers" ? watcherStatus : null;
  const showsActionSection = hasSelectedGames || Boolean(actionWatcherStatus);

  useEffect(() => {
    setSelectedGameNames((currentGameNames) =>
      currentGameNames.filter((gameName) => availableGameNames.includes(gameName)),
    );
  }, [availableGameNames]);

  useEffect(() => {
    if (filterOptions.some((option) => option.value === selectedFilter)) {
      return;
    }

    setSelectedFilter("all");
  }, [filterOptions, selectedFilter]);

  useEffect(() => {
    if (!showsDeletePanel || canDeleteSelected) {
      return;
    }

    setShowsDeletePanel(false);
    setDeleteConfirmed(false);
  }, [canDeleteSelected, showsDeletePanel]);

  useEffect(() => {
    setDeleteFeedback(null);
  }, [selectedGameNames]);

  useEffect(() => {
    if (normalizedAdminSecret) {
      return;
    }

    autoLoadedSecretKeyRef.current = null;
  }, [normalizedAdminSecret]);

  useEffect(() => {
    const autoLoadKey = `${environmentLabel}:${normalizedAdminSecret}`;

    if (!normalizedAdminSecret || isBusy || hasLoadedLiveIndexers || autoLoadedSecretKeyRef.current === autoLoadKey) {
      return;
    }

    autoLoadedSecretKeyRef.current = autoLoadKey;
    void onLoadLiveIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: [],
    });
  }, [environmentLabel, hasLoadedLiveIndexers, isBusy, normalizedAdminSecret, onLoadLiveIndexers]);

  const toggleDeletePanel = () => {
    const nextOpen = !showsDeletePanel;

    setShowsDeletePanel(nextOpen);
    setDeleteConfirmed(false);
  };

  const recreateTypedNames = () => {
    if (!canRecreateTypedNames) {
      return;
    }

    void onCreateIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: lookupGameNames,
    });
  };

  const recreateSelectedIndexers = () => {
    if (!canRecreateSelected) {
      return;
    }

    void onCreateIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: actionTargets.recreatableGameNames,
    });
  };

  const updateSelectedIndexers = () => {
    if (!canUpdateSelected) {
      return;
    }

    void onUpdateIndexerTier({
      adminSecret: normalizedAdminSecret,
      gameNames: actionTargets.updatableGameNames,
      tier: selectedTier,
    });
  };

  const deleteSelectedIndexers = async () => {
    if (!canDeleteSelected || !deleteConfirmed) {
      return;
    }

    setDeleteFeedback(null);
    const result = await onDeleteIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: actionTargets.deletableGameNames,
    });

    if (!result) {
      return;
    }

    setDeleteFeedback(result);
  };

  const refreshLiveIndexerList = () => {
    if (!canLoadIndexers) {
      return;
    }

    void onRefreshLiveIndexers({
      adminSecret: normalizedAdminSecret,
      gameNames: [],
    });
  };

  return (
    <article className="w-full md:mx-auto md:max-w-lg">
      <div className={cn("px-0 py-0 md:rounded-[28px] md:border md:px-7 md:py-8", appearance.featureSurfaceClassName)}>
        <div className={cn("space-y-3 md:space-y-4 md:pb-0", showsActionSection ? "pb-24" : "pb-0")}>
          <FactoryV2ManageIndexersSectionCard title="Indexers" appearanceClassName={appearance.quietSurfaceClassName}>
            {!hasSecret && !hasLoadedLiveIndexers ? (
              <FactoryV2IndexerEmptyState>Add the admin secret above to manage indexers.</FactoryV2IndexerEmptyState>
            ) : hasLoadedLiveIndexers ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-black/76">
                      {hasSelectedGames
                        ? `${selectedGameNames.length} selected`
                        : `${filteredLiveIndexers.length} shown`}
                    </div>
                    <div className="text-xs font-medium text-black/52">
                      {resolveLiveIndexerSnapshotStatusLine({ liveSummary, liveIndexersUpdatedAt })}
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="factory-indexer-refresh"
                    aria-label="Check Slot"
                    title="Check Slot"
                    disabled={!canLoadIndexers}
                    onClick={refreshLiveIndexerList}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCw className={cn("h-4 w-4", accessWatcherStatus ? "animate-spin" : "")} aria-hidden="true" />
                  </button>
                </div>

                {accessWatcherStatus ? <FactoryV2ManageIndexerWatcherCard watcherStatus={accessWatcherStatus} /> : null}

                {notice && notice !== deleteFeedback?.message ? (
                  <div className="rounded-[18px] border border-black/8 bg-white/74 px-4 py-3 text-sm text-black/62">
                    {notice}
                  </div>
                ) : null}

                {liveIndexers.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`factory-indexer-filter-${option.value}`}
                        disabled={isBusy}
                        onClick={() => setSelectedFilter(option.value)}
                        className={cn(
                          "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-2 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50",
                          selectedFilter === option.value
                            ? appearance.activeToggleClassName
                            : appearance.secondaryButtonClassName,
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {hasSelectedGames ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-black/8 bg-white/64 px-3 py-2">
                    <div className="text-sm font-semibold text-black/76">{selectedGameNames.length} selected</div>
                    <button
                      type="button"
                      data-testid="factory-indexer-clear-selection"
                      disabled={isBusy}
                      onClick={() => setSelectedGameNames([])}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                ) : filteredGameNames.length > 1 ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      data-testid="factory-indexer-select-all"
                      disabled={isBusy}
                      onClick={() => setSelectedGameNames(filteredGameNames)}
                      className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-black/64 transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Select visible
                    </button>
                  </div>
                ) : null}

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

                <div className="border-t border-black/8 pt-2">
                  <button
                    type="button"
                    data-testid="factory-indexer-open-lookup"
                    disabled={isBusy}
                    onClick={() => setShowsLookupPanel((currentValue) => !currentValue)}
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-xs font-semibold text-black/64 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Recreate by name
                    <ChevronDown
                      className={cn("h-4 w-4 transition-transform", showsLookupPanel ? "rotate-180" : "rotate-0")}
                    />
                  </button>
                </div>

                {showsLookupPanel ? (
                  <div className="space-y-2 rounded-[20px] border border-black/8 bg-[#fff8f1] p-3">
                    <label className="block">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-black/44">
                        Game names
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
                      <div className="text-xs font-medium text-black/52">
                        {lookupGameNames.length} {lookupGameNames.length === 1 ? "name" : "names"}
                      </div>
                    ) : null}
                    <div>
                      <button
                        type="button"
                        data-testid="factory-indexer-recreate-names"
                        disabled={!canRecreateTypedNames}
                        onClick={recreateTypedNames}
                        className={cn(
                          "inline-flex h-10 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          appearance.primaryButtonClassName,
                        )}
                      >
                        Recreate
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {accessWatcherStatus ? (
                  <FactoryV2ManageIndexerWatcherCard watcherStatus={accessWatcherStatus} />
                ) : (
                  <>
                    <FactoryV2IndexerEmptyState>Opening saved indexers...</FactoryV2IndexerEmptyState>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        data-testid="factory-indexer-refresh"
                        disabled={!canLoadIndexers}
                        onClick={refreshLiveIndexerList}
                        className={cn(
                          "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          appearance.secondaryButtonClassName,
                        )}
                      >
                        <RotateCw
                          className={cn("h-4 w-4", accessWatcherStatus ? "animate-spin" : "")}
                          aria-hidden="true"
                        />
                        Check Slot
                      </button>
                    </div>
                  </>
                )}

                {notice && notice !== deleteFeedback?.message ? (
                  <div className="rounded-[18px] border border-black/8 bg-white/74 px-4 py-3 text-sm text-black/62">
                    {notice}
                  </div>
                ) : null}
              </div>
            )}
          </FactoryV2ManageIndexersSectionCard>

          {showsActionSection ? (
            <FactoryV2ManageIndexersActionBar
              appearance={appearance}
              selectedGameNames={selectedGameNames}
              actionTargets={actionTargets}
              isBusy={isBusy}
              watcherStatus={actionWatcherStatus}
              selectedTier={selectedTier}
              showsDeletePanel={showsDeletePanel}
              deleteConfirmed={deleteConfirmed}
              deleteFeedback={deleteFeedback}
              onSelectTier={setSelectedTier}
              onToggleDeletePanel={toggleDeletePanel}
              onConfirmDelete={() => setDeleteConfirmed(true)}
              onCancelDelete={() => {
                setShowsDeletePanel(false);
                setDeleteConfirmed(false);
              }}
              onRecreate={recreateSelectedIndexers}
              onUpdateTier={updateSelectedIndexers}
              onDelete={deleteSelectedIndexers}
              canRecreate={canRecreateSelected}
              canUpdateTier={canUpdateSelected}
              canDelete={canDeleteSelected}
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
  selectedGameNames,
  actionTargets,
  isBusy,
  watcherStatus,
  selectedTier,
  showsDeletePanel,
  deleteConfirmed,
  deleteFeedback,
  onSelectTier,
  onToggleDeletePanel,
  onConfirmDelete,
  onCancelDelete,
  onRecreate,
  onUpdateTier,
  onDelete,
  canRecreate,
  canUpdateTier,
  canDelete,
}: {
  appearance: ReturnType<typeof resolveFactoryModeAppearance>;
  selectedGameNames: string[];
  actionTargets: ReturnType<typeof resolveSelectedIndexerActionTargets>;
  isBusy: boolean;
  watcherStatus: ReturnType<typeof resolveManageIndexerWatcherStatus>;
  selectedTier: FactoryWorkerIndexerTier;
  showsDeletePanel: boolean;
  deleteConfirmed: boolean;
  deleteFeedback: FactoryActionFeedback | null;
  onSelectTier: (tier: FactoryWorkerIndexerTier) => void;
  onToggleDeletePanel: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onRecreate: () => void;
  onUpdateTier: () => void;
  onDelete: () => void;
  canRecreate: boolean;
  canUpdateTier: boolean;
  canDelete: boolean;
}) => {
  const hasSelectedGames = selectedGameNames.length > 0;

  return (
    <div
      data-testid="factory-indexer-action-panel"
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

          {actionTargets.recreatableEntries.length > 0 ? (
            <FactoryV2ManageIndexerActionCard
              title="Recreate"
              description={resolveSelectionPreviewText(actionTargets.recreatableEntries)}
            >
              <button
                type="button"
                data-testid="factory-indexer-action-create"
                disabled={!canRecreate}
                onClick={onRecreate}
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  appearance.primaryButtonClassName,
                )}
              >
                {resolveRecreateActionLabel(actionTargets.recreatableGameNames.length)}
              </button>
            </FactoryV2ManageIndexerActionCard>
          ) : null}

          {actionTargets.updatableEntries.length > 0 ? (
            <FactoryV2ManageIndexerActionCard
              title="Change tier"
              description={resolveSelectionPreviewText(actionTargets.updatableEntries)}
            >
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
              <button
                type="button"
                data-testid="factory-indexer-action-update-tier"
                disabled={!canUpdateTier}
                onClick={onUpdateTier}
                className={cn(
                  "inline-flex w-full items-center justify-center rounded-full px-6 py-3.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                  appearance.primaryButtonClassName,
                )}
              >
                {resolveTierActionLabel(actionTargets.updatableGameNames.length, selectedTier)}
              </button>
            </FactoryV2ManageIndexerActionCard>
          ) : null}

          {actionTargets.deletableEntries.length > 0 ? (
            <div className="rounded-[20px] border border-black/8 bg-white/64 p-3">
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-black/78">Delete</div>
                  <p className="text-sm leading-5 text-black/56">
                    {resolveSelectionPreviewText(actionTargets.deletableEntries)}
                  </p>
                </div>
                {!showsDeletePanel ? (
                  <button
                    type="button"
                    disabled={isBusy}
                    data-testid="factory-indexer-open-delete"
                    onClick={onToggleDeletePanel}
                    className="inline-flex w-full items-center justify-center rounded-full border border-[#a62f28]/20 bg-[#fff8f7] px-4 py-3 text-sm font-semibold text-[#8d2a23] transition-colors hover:bg-[#fff1ee] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resolveDeleteActionLabel(actionTargets.deletableGameNames.length)}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {deleteConfirmed ? (
                      <div className="rounded-[18px] border border-[#a62f28]/18 bg-[#fff1ee] px-4 py-3 text-sm text-[#8d2a23]/82">
                        Delete is armed for the current live selection only.
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="factory-indexer-confirm-delete"
                        disabled={!canDelete}
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
            </div>
          ) : null}
        </>
      ) : null}

      {watcherStatus ? <FactoryV2ManageIndexerWatcherCard watcherStatus={watcherStatus} /> : null}
      {deleteFeedback ? <FactoryV2ManageIndexerDeleteFeedback feedback={deleteFeedback} /> : null}
      {hasSelectedGames && actionTargets.deletableEntries.length > 0 && deleteConfirmed ? (
        <button
          type="button"
          data-testid="factory-indexer-action-delete"
          disabled={!canDelete}
          onClick={onDelete}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#a62f28] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#92261f] disabled:cursor-not-allowed disabled:bg-[#a62f28]/45"
        >
          {resolveDeleteActionLabel(actionTargets.deletableGameNames.length)}
        </button>
      ) : null}
    </div>
  );
};

const FactoryV2ManageIndexerDeleteFeedback = ({ feedback }: { feedback: FactoryActionFeedback }) => (
  <div
    data-testid="factory-indexer-delete-feedback"
    aria-live="polite"
    className={cn(
      "rounded-[18px] border px-4 py-3 text-sm leading-6",
      feedback.ok
        ? "border-emerald-700/15 bg-emerald-50/80 text-emerald-950"
        : "border-[#a62f28]/18 bg-[#fff1ee] text-[#8d2a23]",
    )}
  >
    {feedback.message}
  </div>
);

const FactoryV2ManageIndexerActionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <div className="space-y-3 rounded-[20px] border border-black/8 bg-white/64 p-3">
    <div className="space-y-1">
      <div className="text-sm font-semibold text-black/78">{title}</div>
      <p className="text-sm leading-5 text-black/56">{description}</p>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

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
  liveSummary,
  liveIndexersUpdatedAt,
}: {
  liveSummary: ReturnType<typeof resolveLiveIndexerSummary>;
  liveIndexersUpdatedAt: string | null;
}) {
  const parts = [`${liveSummary.existing} live`];

  if (liveSummary.missing > 0) {
    parts.push(`${liveSummary.missing} missing`);
  }

  if (liveSummary.indeterminate > 0) {
    parts.push(`${liveSummary.indeterminate} review`);
  }

  if (liveIndexersUpdatedAt) {
    parts.push(`Synced ${formatIndexerTimestamp(liveIndexersUpdatedAt)}`);
  }

  return parts.join(" · ");
}

function resolveVisibleLiveIndexers(entries: FactoryWorkerLiveIndexerEntry[], filter: FactoryManageIndexerFilter) {
  return filterAndSortLiveIndexers(entries, filter);
}

function filterAndSortLiveIndexers(entries: FactoryWorkerLiveIndexerEntry[], filter: FactoryManageIndexerFilter) {
  return sortLiveIndexers(filterLiveIndexers(entries, filter));
}

function sortLiveIndexers(entries: FactoryWorkerLiveIndexerEntry[]) {
  return [...entries].sort((leftEntry, rightEntry) => {
    const stateOrderDifference =
      resolveLiveIndexerStateOrder(leftEntry.liveState.state) -
      resolveLiveIndexerStateOrder(rightEntry.liveState.state);

    if (stateOrderDifference !== 0) {
      return stateOrderDifference;
    }

    return leftEntry.gameName.localeCompare(rightEntry.gameName);
  });
}

function resolveLiveIndexerStateOrder(state: FactoryWorkerLiveIndexerEntry["liveState"]["state"]) {
  switch (state) {
    case "missing":
      return 0;
    case "indeterminate":
      return 1;
    default:
      return 2;
  }
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

function resolveAvailableManageIndexerFilters(
  liveSummary: ReturnType<typeof resolveLiveIndexerSummary>,
): FactoryManageIndexerFilterOption[] {
  return FACTORY_INDEXER_FILTER_OPTIONS.filter((option) => {
    if (option.value === "all") {
      return true;
    }

    if (option.value === "live") {
      return liveSummary.existing > 0;
    }

    if (option.value === "missing") {
      return liveSummary.missing > 0;
    }

    return liveSummary.indeterminate > 0;
  });
}

function resolveLiveIndexerPrimaryBadge(entry: FactoryWorkerLiveIndexerEntry) {
  if (entry.liveState.state === "existing") {
    return entry.liveState.currentTier ?? "live";
  }

  if (entry.liveState.state === "missing") {
    return "missing";
  }

  return "review";
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

function resolveSelectedIndexerActionTargets(entries: FactoryWorkerLiveIndexerEntry[]) {
  return entries.reduce(
    (targets, entry) => {
      if (entry.liveState.state === "existing") {
        targets.updatableEntries.push(entry);
        targets.updatableGameNames.push(entry.gameName);
        targets.deletableEntries.push(entry);
        targets.deletableGameNames.push(entry.gameName);
        return targets;
      }

      targets.recreatableEntries.push(entry);
      targets.recreatableGameNames.push(entry.gameName);
      return targets;
    },
    {
      recreatableEntries: [] as FactoryWorkerLiveIndexerEntry[],
      recreatableGameNames: [] as string[],
      updatableEntries: [] as FactoryWorkerLiveIndexerEntry[],
      updatableGameNames: [] as string[],
      deletableEntries: [] as FactoryWorkerLiveIndexerEntry[],
      deletableGameNames: [] as string[],
    },
  );
}

function resolveRecreateActionLabel(count: number) {
  return count === 1 ? "Recreate selected indexer" : `Recreate ${count} selected indexers`;
}

function resolveTierActionLabel(count: number, tier: FactoryWorkerIndexerTier) {
  return count === 1 ? `Move live indexer to ${tier}` : `Move ${count} live indexers to ${tier}`;
}

function resolveDeleteActionLabel(count: number) {
  return count === 1 ? "Delete live indexer" : `Delete ${count} live indexers`;
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
