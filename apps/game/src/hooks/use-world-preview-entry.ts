import type { GameChain as Chain } from "@realms-world/chain";
import type { BlitzGameLoadoutDraft } from "@/three/cosmetics/types";
import { resolveCosmeticsLoadoutScopeKeyForChain } from "@/ui/features/cosmetics/lib/loadout-scope";
import type { DevPreviewEntryStateRecord } from "./store/use-dev-preview-entry-store";

export type { DevPreviewEntryStateRecord } from "./store/use-dev-preview-entry-store";

export interface DevPreviewEntryStateAdapter {
  setPreviewEntry: (key: string, entry: DevPreviewEntryStateRecord) => void;
}

interface DevPreviewCosmeticsAdapter {
  getPendingBlitzLoadout: (worldKey: string, owner: string) => BlitzGameLoadoutDraft | undefined;
  setPendingBlitzLoadout: (worldKey: string, owner: string, draft: BlitzGameLoadoutDraft) => void;
  markAppliedBlitzLoadout: (worldKey: string, owner: string) => void;
}

interface CreateWorldPreviewEntryControllerOptions {
  isDev: boolean;
  enabled?: boolean;
  address?: string | null;
  chain: Chain;
  worldName: string;
  now?: () => number;
  previewEntries: DevPreviewEntryStateAdapter;
  cosmeticsStore?: DevPreviewCosmeticsAdapter;
}

const normalizePreviewAddress = (address: string): string => address.trim().toLowerCase();
const arePreviewDraftsEqual = (
  left: BlitzGameLoadoutDraft | null | undefined,
  right: BlitzGameLoadoutDraft | null | undefined,
): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

export const buildDevPreviewWorldKey = ({
  chain,
  worldName,
  address,
}: {
  chain: Chain;
  worldName: string;
  address: string;
}): string => `${chain}:${worldName}:${normalizePreviewAddress(address)}`;

export const createWorldPreviewEntryController = ({
  isDev,
  enabled = true,
  address,
  chain,
  worldName,
  now = () => Date.now(),
  previewEntries,
  cosmeticsStore,
}: CreateWorldPreviewEntryControllerOptions) => {
  const normalizedAddress = address ? normalizePreviewAddress(address) : null;
  const worldLoadoutKey = `blitz:${chain}:${worldName}`;
  const fallbackLoadoutKey = resolveCosmeticsLoadoutScopeKeyForChain(chain);
  const previewWorldKey = normalizedAddress
    ? buildDevPreviewWorldKey({ chain, worldName, address: normalizedAddress })
    : null;

  const canPreviewEnter = isDev && enabled && Boolean(previewWorldKey);

  const enterPreview = async (): Promise<void> => {
    if (!isDev) {
      throw new Error("Dev preview entry is only available in development builds.");
    }

    if (!enabled || !previewWorldKey) {
      throw new Error("Dev preview entry is not available for this world.");
    }

    if (cosmeticsStore && normalizedAddress) {
      const worldDraft = cosmeticsStore.getPendingBlitzLoadout(worldLoadoutKey, normalizedAddress);
      const fallbackDraft = cosmeticsStore.getPendingBlitzLoadout(fallbackLoadoutKey, normalizedAddress);

      if (fallbackDraft != null && !arePreviewDraftsEqual(worldDraft, fallbackDraft)) {
        cosmeticsStore.setPendingBlitzLoadout(worldLoadoutKey, normalizedAddress, fallbackDraft);
      }

      cosmeticsStore.markAppliedBlitzLoadout(worldLoadoutKey, normalizedAddress);
    }

    previewEntries.setPreviewEntry(previewWorldKey, {
      previewEntered: true,
      enteredAt: now(),
      loadoutWorldKey: worldLoadoutKey,
    });
  };

  return {
    canPreviewEnter,
    previewWorldKey,
    worldLoadoutKey,
    enterPreview,
  };
};
