import type { Chain } from "@contracts";

export interface DevPreviewEntryStateRecord {
  previewEntered: boolean;
  enteredAt: number;
  loadoutWorldKey: string;
}

export interface DevPreviewEntryStateAdapter {
  setPreviewEntry: (key: string, entry: DevPreviewEntryStateRecord) => void;
}

interface CreateWorldPreviewEntryControllerOptions {
  isDev: boolean;
  enabled?: boolean;
  address?: string | null;
  chain: Chain;
  worldName: string;
  now?: () => number;
  previewEntries: DevPreviewEntryStateAdapter;
}

const normalizePreviewAddress = (address: string): string => address.trim().toLowerCase();

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
}: CreateWorldPreviewEntryControllerOptions) => {
  const normalizedAddress = address ? normalizePreviewAddress(address) : null;
  const worldLoadoutKey = `blitz:${chain}:${worldName}`;
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
