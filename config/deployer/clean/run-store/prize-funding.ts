import {
  updateGitHubBranchJsonFile,
  requireGitHubBranchStoreConfig,
  type ResolveGitHubBranchStoreConfigOptions,
} from "./github";
import {
  resolveFactoryRotationRunRecordPath,
  resolveFactoryRunRecordPath,
  resolveFactorySeriesRunRecordPath,
} from "./paths";
import type {
  FactoryRotationRunIdentity,
  FactoryRotationRunRecord,
  FactoryRunIdentity,
  FactoryRunRecord,
  FactorySeriesRunIdentity,
  FactorySeriesRunRecord,
} from "./types";
import type { PrizeFundingState, PrizeFundingTransfer } from "../types";

interface RecordFactoryPrizeFundingOptions extends ResolveGitHubBranchStoreConfigOptions {}

function appendPrizeFundingTransfer(
  currentPrizeFunding: PrizeFundingState | undefined,
  transfer: PrizeFundingTransfer,
): PrizeFundingState {
  return {
    transfers: [...(currentPrizeFunding?.transfers ?? []), transfer],
  };
}

function buildGamePrizeFundingCommitMessage(identity: FactoryRunIdentity) {
  return `factory-runs: record prize funding for ${identity.environmentId}/${identity.gameName}`;
}

function buildSeriesPrizeFundingCommitMessage(identity: FactorySeriesRunIdentity) {
  return `factory-runs: record prize funding for ${identity.environmentId}/${identity.seriesName}`;
}

function buildRotationPrizeFundingCommitMessage(identity: FactoryRotationRunIdentity) {
  return `factory-runs: record prize funding for ${identity.environmentId}/${identity.rotationName}`;
}

function applyPrizeFundingTransferToGameRunRecord(
  currentRun: FactoryRunRecord | undefined,
  transfer: PrizeFundingTransfer,
): FactoryRunRecord {
  if (!currentRun) {
    throw new Error("Factory game run record does not exist");
  }

  return {
    ...currentRun,
    updatedAt: transfer.fundedAt,
    artifacts: {
      ...currentRun.artifacts,
      prizeFunding: appendPrizeFundingTransfer(currentRun.artifacts.prizeFunding, transfer),
    },
  };
}

function applyPrizeFundingTransferToSeriesRunRecord(
  currentRun: FactorySeriesRunRecord | undefined,
  selectedGameNames: readonly string[],
  transfer: PrizeFundingTransfer,
): FactorySeriesRunRecord {
  if (!currentRun) {
    throw new Error("Factory series run record does not exist");
  }

  return {
    ...currentRun,
    updatedAt: transfer.fundedAt,
    summary: {
      ...currentRun.summary,
      games: currentRun.summary.games.map((game) =>
        selectedGameNames.includes(game.gameName)
          ? {
              ...game,
              artifacts: {
                ...game.artifacts,
                prizeFunding: appendPrizeFundingTransfer(game.artifacts.prizeFunding, transfer),
              },
            }
          : game,
      ),
    },
  };
}

function applyPrizeFundingTransferToRotationRunRecord(
  currentRun: FactoryRotationRunRecord | undefined,
  selectedGameNames: readonly string[],
  transfer: PrizeFundingTransfer,
): FactoryRotationRunRecord {
  if (!currentRun) {
    throw new Error("Factory rotation run record does not exist");
  }

  return {
    ...currentRun,
    updatedAt: transfer.fundedAt,
    summary: {
      ...currentRun.summary,
      games: currentRun.summary.games.map((game) =>
        selectedGameNames.includes(game.gameName)
          ? {
              ...game,
              artifacts: {
                ...game.artifacts,
                prizeFunding: appendPrizeFundingTransfer(game.artifacts.prizeFunding, transfer),
              },
            }
          : game,
      ),
    },
  };
}

export async function recordFactoryGamePrizeFundingSucceeded(
  identity: FactoryRunIdentity,
  transfer: PrizeFundingTransfer,
  options: RecordFactoryPrizeFundingOptions = {},
): Promise<FactoryRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);

  return updateGitHubBranchJsonFile<FactoryRunRecord>(
    config,
    resolveFactoryRunRecordPath(identity),
    (currentRun) => applyPrizeFundingTransferToGameRunRecord(currentRun, transfer),
    buildGamePrizeFundingCommitMessage(identity),
  );
}

export async function recordFactorySeriesPrizeFundingSucceeded(
  identity: FactorySeriesRunIdentity,
  selectedGameNames: readonly string[],
  transfer: PrizeFundingTransfer,
  options: RecordFactoryPrizeFundingOptions = {},
): Promise<FactorySeriesRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);

  return updateGitHubBranchJsonFile<FactorySeriesRunRecord>(
    config,
    resolveFactorySeriesRunRecordPath(identity),
    (currentRun) => applyPrizeFundingTransferToSeriesRunRecord(currentRun, selectedGameNames, transfer),
    buildSeriesPrizeFundingCommitMessage(identity),
  );
}

export async function recordFactoryRotationPrizeFundingSucceeded(
  identity: FactoryRotationRunIdentity,
  selectedGameNames: readonly string[],
  transfer: PrizeFundingTransfer,
  options: RecordFactoryPrizeFundingOptions = {},
): Promise<FactoryRotationRunRecord> {
  const config = requireGitHubBranchStoreConfig(options);

  return updateGitHubBranchJsonFile<FactoryRotationRunRecord>(
    config,
    resolveFactoryRotationRunRecordPath(identity),
    (currentRun) => applyPrizeFundingTransferToRotationRunRecord(currentRun, selectedGameNames, transfer),
    buildRotationPrizeFundingCommitMessage(identity),
  );
}
