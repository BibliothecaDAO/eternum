import type { Chain } from "@contracts";
import { useAccount } from "@starknet-react/core";
import { useCallback, useMemo, useState } from "react";
import {
  useDevPreviewEntryStore,
  type DevPreviewEntryStateRecord,
} from "./store/use-dev-preview-entry-store";

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

type PreviewEntryStage = "idle" | "preparing" | "done" | "error";

interface UseWorldPreviewEntryOptions {
  worldName: string;
  chain: Chain;
  enabled?: boolean;
}

export const useWorldPreviewEntry = ({ worldName, chain, enabled = true }: UseWorldPreviewEntryOptions) => {
  const { address } = useAccount();
  const [previewEntryStage, setPreviewEntryStage] = useState<PreviewEntryStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const setPreviewEntry = useDevPreviewEntryStore((state) => state.setPreviewEntry);
  const clearPreviewEntry = useDevPreviewEntryStore((state) => state.clearPreviewEntry);

  const controller = useMemo(
    () =>
      createWorldPreviewEntryController({
        isDev: import.meta.env.DEV,
        enabled,
        address,
        chain,
        worldName,
        previewEntries: { setPreviewEntry },
      }),
    [address, chain, enabled, setPreviewEntry, worldName],
  );

  const previewEntry = useDevPreviewEntryStore(
    useCallback(
      (state) => (controller.previewWorldKey ? state.entries[controller.previewWorldKey] ?? null : null),
      [controller.previewWorldKey],
    ),
  );

  const enterPreview = useCallback(async () => {
    setError(null);
    setPreviewEntryStage("preparing");

    try {
      await controller.enterPreview();
      setPreviewEntryStage("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to enter dev preview.");
      setPreviewEntryStage("error");
      throw cause;
    }
  }, [controller]);

  const clearPreview = useCallback(() => {
    if (!controller.previewWorldKey) {
      return;
    }

    clearPreviewEntry(controller.previewWorldKey);
    setError(null);
    setPreviewEntryStage("idle");
  }, [clearPreviewEntry, controller.previewWorldKey]);

  return {
    enterPreview,
    clearPreview,
    canPreviewEnter: controller.canPreviewEnter,
    previewWorldKey: controller.previewWorldKey,
    worldLoadoutKey: controller.worldLoadoutKey,
    previewEntry,
    previewEntryStage,
    error,
  };
};
