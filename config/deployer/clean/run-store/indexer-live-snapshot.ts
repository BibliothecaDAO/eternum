import { requireGitHubBranchStoreConfig, readGitHubBranchJsonFile, updateGitHubBranchJsonFile } from "./github";
import type { IndexerLiveState } from "../types";

const FACTORY_LIVE_INDEXER_SNAPSHOT_PATH = "indexes/indexers/live.json";

export interface FactoryLiveIndexerSnapshotEntry {
  gameName: string;
  liveState: IndexerLiveState;
  updatedAt: string;
}

export interface FactoryLiveIndexerSnapshot {
  version: 1;
  updatedAt: string;
  entries: Record<string, FactoryLiveIndexerSnapshotEntry>;
}

function buildEmptyFactoryLiveIndexerSnapshot(): FactoryLiveIndexerSnapshot {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

function buildSnapshotEntry(
  gameName: string,
  liveState: IndexerLiveState,
  updatedAt: string,
): FactoryLiveIndexerSnapshotEntry {
  return {
    gameName,
    liveState,
    updatedAt,
  };
}

export function resolveFactoryLiveIndexerSnapshotPath() {
  return FACTORY_LIVE_INDEXER_SNAPSHOT_PATH;
}

export async function readFactoryLiveIndexerSnapshot(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
): Promise<FactoryLiveIndexerSnapshot> {
  const { value } = await readGitHubBranchJsonFile<FactoryLiveIndexerSnapshot>(
    config,
    FACTORY_LIVE_INDEXER_SNAPSHOT_PATH,
  );
  return value || buildEmptyFactoryLiveIndexerSnapshot();
}

export async function replaceFactoryLiveIndexerSnapshot(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  entries: FactoryLiveIndexerSnapshotEntry[],
  message: string,
) {
  const updatedAt = new Date().toISOString();
  return updateGitHubBranchJsonFile<FactoryLiveIndexerSnapshot>(
    config,
    FACTORY_LIVE_INDEXER_SNAPSHOT_PATH,
    () => ({
      version: 1,
      updatedAt,
      entries: Object.fromEntries(
        entries.map((entry) => [entry.gameName, buildSnapshotEntry(entry.gameName, entry.liveState, updatedAt)]),
      ),
    }),
    message,
  );
}

export async function updateFactoryLiveIndexerSnapshotEntries(
  config: ReturnType<typeof requireGitHubBranchStoreConfig>,
  entries: Array<{ gameName: string; liveState: IndexerLiveState }>,
  message: string,
) {
  const updatedAt = new Date().toISOString();
  return updateGitHubBranchJsonFile<FactoryLiveIndexerSnapshot>(
    config,
    FACTORY_LIVE_INDEXER_SNAPSHOT_PATH,
    (currentSnapshot) => ({
      ...(currentSnapshot || buildEmptyFactoryLiveIndexerSnapshot()),
      version: 1,
      updatedAt,
      entries: {
        ...(currentSnapshot?.entries || {}),
        ...Object.fromEntries(
          entries.map((entry) => [entry.gameName, buildSnapshotEntry(entry.gameName, entry.liveState, updatedAt)]),
        ),
      },
    }),
    message,
  );
}
