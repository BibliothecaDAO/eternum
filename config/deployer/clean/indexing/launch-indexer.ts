import type { IndexerCreationResult, IndexerRequest } from "../types";
import { createAppchainIndexer } from "./appchain-indexer";
import { createIndexer } from "./indexer";

export interface LaunchIndexerOptions {
  onProgress?: (message: string) => void;
}

/**
 * Provider seam for the launch runner's create-indexer step.
 *
 * - appchain: one shared torii indexes every world, so this appends the world
 *   to its config and rolls the service (no per-game indexer exists).
 * - everything else: the GitHub Actions workflow (factory-torii-deployer.yml).
 */
export function createLaunchIndexer(
  request: IndexerRequest,
  options: LaunchIndexerOptions = {},
): Promise<IndexerCreationResult> {
  if (request.env === "appchain") {
    return createAppchainIndexer(request, options);
  }

  return createIndexer(request, options);
}
