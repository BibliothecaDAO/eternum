import { playerCosmeticsStore } from "@/three/cosmetics/player-cosmetics-store";
import { resolveEligibleCosmeticIds } from "@/three/cosmetics/ownership";
import type { BlitzGameLoadoutDraft } from "@/three/cosmetics/types";
import { useAccount } from "@starknet-react/core";
import { useSyncExternalStore } from "react";
import type { CosmeticItem } from "../config/cosmetics.data";

const DEFAULT_MAX_SELECTIONS = 8;

export interface CosmeticLoadoutViewState {
  selectedBySlot: Record<string, string>;
  pendingTokenIds: string[];
  pendingCount: number;
  isEmpty: boolean;
  isValid: boolean;
  errors: string[];
  addCosmetic: (slot: string, item: CosmeticItem) => void;
  removeCosmetic: (slot: string) => void;
  clearAll: () => void;
  isTokenSelected: (tokenId: string) => boolean;
}

interface UseCosmeticLoadoutStoreOptions {
  scopeKey?: string;
  fallbackScopeKeys?: string[];
  maxSelections?: number;
}

const resolveDraft = (
  owner: string | undefined,
  scopeKey: string,
  fallbackScopeKeys: readonly string[],
): BlitzGameLoadoutDraft | undefined => {
  if (!owner) return undefined;

  return (
    playerCosmeticsStore.getPendingBlitzLoadout(scopeKey, owner) ??
    fallbackScopeKeys
      .map((fallbackScopeKey) => playerCosmeticsStore.getPendingBlitzLoadout(fallbackScopeKey, owner))
      .find(Boolean)
  );
};

const buildErrors = (pendingCount: number, maxSelections: number): string[] => {
  if (pendingCount > maxSelections) {
    return [`Select at most ${maxSelections} cosmetics for the next Blitz registration.`];
  }

  return [];
};

export const buildDraftForEquippedCosmetic = ({
  currentDraft,
  slot,
  item,
  maxSelections,
}: {
  currentDraft: BlitzGameLoadoutDraft | undefined;
  slot: string;
  item: CosmeticItem;
  maxSelections?: number;
}): BlitzGameLoadoutDraft => {
  const tokenId = item.tokenId ?? "";
  const ownershipKey = item.attributesRaw?.trim().toLowerCase();
  const cosmeticIds = ownershipKey ? resolveEligibleCosmeticIds([ownershipKey]) : [];
  const selectedBySlot = {
    ...(currentDraft?.selectedBySlot ?? {}),
    [slot]: {
      tokenId,
      cosmeticIds,
      ownershipKey,
      label: item.name,
    },
  };
  const tokenIds = Object.values(selectedBySlot)
    .map((selection) => selection.tokenId)
    .filter(Boolean)
    .slice(0, maxSelections ?? DEFAULT_MAX_SELECTIONS);

  return {
    tokenIds,
    selectedBySlot,
  };
};

export const buildCosmeticLoadoutViewState = ({
  draft,
  maxSelections = DEFAULT_MAX_SELECTIONS,
}: {
  draft: BlitzGameLoadoutDraft | undefined;
  maxSelections?: number;
}) => {
  const selectedBySlot = Object.fromEntries(
    Object.entries(draft?.selectedBySlot ?? {}).map(([slot, selection]) => [slot, selection.tokenId]),
  );
  const pendingCount = draft?.tokenIds.length ?? 0;
  const errors = buildErrors(pendingCount, maxSelections);

  return {
    selectedBySlot,
    pendingTokenIds: draft?.tokenIds ?? [],
    pendingCount,
    isEmpty: pendingCount === 0,
    isValid: errors.length === 0,
    errors,
  };
};

export const describeBlitzLoadoutSummary = ({
  pendingCount,
  isValid,
  isEmpty,
  errors,
}: Pick<CosmeticLoadoutViewState, "pendingCount" | "isValid" | "isEmpty" | "errors">): string => {
  if (isEmpty) {
    return "No cosmetics selected for the next Blitz registration.";
  }

  if (!isValid) {
    return errors[0] ?? "The pending Blitz loadout needs attention.";
  }

  return `${pendingCount} cosmetics ready for the next Blitz registration.`;
};

export const useCosmeticLoadoutStore = <T>(
  selector: (state: CosmeticLoadoutViewState) => T,
  options?: UseCosmeticLoadoutStoreOptions,
): T => {
  const { address } = useAccount();
  const scopeKey = options?.scopeKey ?? "cosmetics:default";
  const fallbackScopeKeys = options?.fallbackScopeKeys ?? [];
  const maxSelections = options?.maxSelections ?? DEFAULT_MAX_SELECTIONS;

  const getState = () => {
    const draft = resolveDraft(address ?? undefined, scopeKey, fallbackScopeKeys);
    const viewState = buildCosmeticLoadoutViewState({
      draft,
      maxSelections,
    });

    const addCosmetic = (slot: string, item: CosmeticItem) => {
      if (!address || !slot || !item.tokenId) {
        return;
      }

      const nextDraft = buildDraftForEquippedCosmetic({
        currentDraft: resolveDraft(address, scopeKey, fallbackScopeKeys),
        slot,
        item,
        maxSelections,
      });
      playerCosmeticsStore.setPendingBlitzLoadout(scopeKey, address, nextDraft);
    };

    const removeCosmetic = (slot: string) => {
      if (!address || !slot) {
        return;
      }

      const currentDraft = resolveDraft(address, scopeKey, fallbackScopeKeys);
      if (!currentDraft?.selectedBySlot?.[slot]) {
        return;
      }

      const selectedBySlot = { ...currentDraft.selectedBySlot };
      delete selectedBySlot[slot];
      const tokenIds = Object.values(selectedBySlot).map((selection) => selection.tokenId);
      playerCosmeticsStore.setPendingBlitzLoadout(scopeKey, address, {
        tokenIds,
        selectedBySlot,
      });
    };

    const clearAll = () => {
      if (!address) {
        return;
      }

      playerCosmeticsStore.setPendingBlitzLoadout(scopeKey, address, {
        tokenIds: [],
        selectedBySlot: {},
      });
    };

    const state: CosmeticLoadoutViewState = {
      ...viewState,
      addCosmetic,
      removeCosmetic,
      clearAll,
      isTokenSelected: (tokenId: string) => viewState.pendingTokenIds.includes(tokenId),
    };

    return state;
  };

  return useSyncExternalStore(playerCosmeticsStore.subscribe.bind(playerCosmeticsStore), () => selector(getState()));
};
