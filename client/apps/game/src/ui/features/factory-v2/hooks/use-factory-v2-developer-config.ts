import { useEffect, useMemo, useRef, useState } from "react";

import { useAccount } from "@starknet-react/core";
import { useAccountStore } from "@/hooks/store/use-account-store";
import {
  DEFAULT_FACTORY_NAMESPACE,
  getFactoryExplorerTxUrl,
  loadFactoryConfigManifest,
  resolveFactoryAddress,
  resolveFactoryConfigDefaultVersion,
} from "@/ui/features/factory/shared/factory-metadata";
import {
  getChainLabel,
  resolveConnectedTxChainFromRuntime,
  switchWalletToChain,
  type WalletChainControllerLike,
} from "@/ui/utils/network-switch";
import { extractTransactionHash, waitForTransactionConfirmation } from "@/ui/utils/transactions";
import { buildFactoryConfigMulticall } from "../developer/factory-config-multicall";
import { buildFactoryConfigSections, listAllFactoryConfigSectionIds } from "../developer/factory-config-sections";
import type {
  FactoryConfigSectionId,
  FactoryDeveloperConfigExecutionState,
  FactoryDeveloperConfigDraft,
} from "../developer/types";
import type { FactoryGameMode, FactoryLaunchChain } from "../types";

type FactoryConfigManifestState = {
  status: "loading" | "ready" | "error";
  errorMessage: string | null;
  manifestLoaded: boolean;
  manifest: Awaited<ReturnType<typeof loadFactoryConfigManifest>> | null;
};

function buildIdleExecutionState(): FactoryDeveloperConfigExecutionState {
  return { status: "idle" };
}

function buildLoadingManifestState(): FactoryConfigManifestState {
  return {
    status: "loading",
    errorMessage: null,
    manifestLoaded: false,
    manifest: null,
  };
}

function buildReadyManifestState(
  manifest: Awaited<ReturnType<typeof loadFactoryConfigManifest>>,
): FactoryConfigManifestState {
  return {
    status: "ready",
    errorMessage: null,
    manifestLoaded: true,
    manifest,
  };
}

function resolveFactoryConfigLoadErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load the factory manifest for this chain.";
}

function buildManifestLoadErrorState(error: unknown): FactoryConfigManifestState {
  return {
    status: "error",
    errorMessage: resolveFactoryConfigLoadErrorMessage(error),
    manifestLoaded: false,
    manifest: null,
  };
}

function resolveFactoryConfigExecutionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Factory config multicall failed.";
}

function resolveFactoryConfigConfirmationErrorMessage(error: unknown): string {
  const details = error instanceof Error ? error.message : "confirmation could not be verified";
  return `Submitted, but confirmation could not be verified: ${details}`;
}

function resolveWalletChainController(connector: unknown): WalletChainControllerLike | null {
  return (connector as { controller?: WalletChainControllerLike } | undefined)?.controller ?? null;
}

function canSubmitFactoryConfigOnCurrentNetwork({
  hasWalletAccount,
  connectedTxChain,
  targetChain,
}: {
  hasWalletAccount: boolean;
  connectedTxChain: FactoryLaunchChain | null;
  targetChain: FactoryLaunchChain;
}) {
  return !hasWalletAccount || (connectedTxChain !== null && connectedTxChain === targetChain);
}

async function submitFactoryConfigMulticall({
  account,
  multicall,
}: {
  account: NonNullable<ReturnType<typeof useAccountStore.getState>["account"]>;
  multicall: ReturnType<typeof buildFactoryConfigMulticall>;
}) {
  const result = await account.execute(multicall);
  const txHash = extractTransactionHash(result);

  if (!txHash) {
    throw new Error("Factory config multicall did not return a transaction hash.");
  }

  return txHash;
}

async function confirmFactoryConfigMulticall({
  account,
  txHash,
}: {
  account: NonNullable<ReturnType<typeof useAccountStore.getState>["account"]>;
  txHash: string;
}) {
  await waitForTransactionConfirmation({
    txHash,
    account,
    label: "factory config multicall",
  });
}

function buildFactoryDeveloperConfigDraft({
  factoryAddress,
  version,
  sections,
}: {
  factoryAddress: string;
  version: string;
  sections: FactoryDeveloperConfigDraft["sections"];
}): FactoryDeveloperConfigDraft {
  return {
    factoryAddress,
    version,
    namespace: DEFAULT_FACTORY_NAMESPACE,
    sections,
  };
}

function resolveSelectedFactoryConfigSections({
  sections,
  selectedSectionIds,
}: {
  sections: FactoryDeveloperConfigDraft["sections"];
  selectedSectionIds: FactoryConfigSectionId[];
}) {
  return sections.filter((section) => selectedSectionIds.includes(section.id));
}

function buildSubmittedExecutionState(txHash: string): FactoryDeveloperConfigExecutionState {
  return {
    status: "submitted",
    txHash,
  };
}

function buildConfirmedExecutionState(txHash: string): FactoryDeveloperConfigExecutionState {
  return {
    status: "confirmed",
    txHash,
  };
}

function buildExecutionErrorState(error: unknown, txHash?: string): FactoryDeveloperConfigExecutionState {
  return {
    status: "error",
    message: txHash
      ? resolveFactoryConfigConfirmationErrorMessage(error)
      : resolveFactoryConfigExecutionErrorMessage(error),
    txHash,
  };
}

function isPendingFactoryConfigExecutionState(
  state: FactoryDeveloperConfigExecutionState,
  txHash: string,
): state is Extract<FactoryDeveloperConfigExecutionState, { status: "submitted"; txHash: string }> {
  return state.status === "submitted" && state.txHash === txHash;
}

export const useFactoryV2DeveloperConfig = ({ mode, chain }: { mode: FactoryGameMode; chain: FactoryLaunchChain }) => {
  const account = useAccountStore((state) => state.account);
  const { chainId, connector } = useAccount();
  const defaultVersion = resolveFactoryConfigDefaultVersion(mode);
  const factoryAddress = resolveFactoryAddress(chain);
  const controller = resolveWalletChainController(connector);
  const connectedTxChain = resolveConnectedTxChainFromRuntime({ chainId, controller }) as FactoryLaunchChain | null;
  const [version, setVersion] = useState(defaultVersion);
  const [selectedSectionIds, setSelectedSectionIds] =
    useState<FactoryConfigSectionId[]>(listAllFactoryConfigSectionIds);
  const [manifestState, setManifestState] = useState<FactoryConfigManifestState>(buildLoadingManifestState);
  const [executionState, setExecutionState] = useState<FactoryDeveloperConfigExecutionState>(buildIdleExecutionState);
  const [showSwitchNetworkPrompt, setShowSwitchNetworkPrompt] = useState(false);
  const executionAttemptRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    setVersion(defaultVersion);
    setSelectedSectionIds(listAllFactoryConfigSectionIds());
    setExecutionState(buildIdleExecutionState());
    setManifestState(buildLoadingManifestState());
    setShowSwitchNetworkPrompt(false);

    void loadFactoryConfigManifest(chain)
      .then((manifest) => {
        if (cancelled) {
          return;
        }

        setManifestState(buildReadyManifestState(manifest));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setManifestState(buildManifestLoadErrorState(error));
      });

    return () => {
      cancelled = true;
    };
  }, [chain, defaultVersion]);

  const clearExecutionState = () => {
    setExecutionState((currentState) => (currentState.status === "sending" ? currentState : buildIdleExecutionState()));
  };

  const sections = useMemo(() => {
    if (!manifestState.manifest) {
      return [];
    }

    return buildFactoryConfigSections({
      manifest: manifestState.manifest,
      version,
      namespace: DEFAULT_FACTORY_NAMESPACE,
      defaultNamespaceWriterAll: true,
    });
  }, [manifestState.manifest, version]);

  const draft: FactoryDeveloperConfigDraft = useMemo(
    () =>
      buildFactoryDeveloperConfigDraft({
        factoryAddress,
        version,
        sections,
      }),
    [factoryAddress, sections, version],
  );

  const selectedSections = useMemo(
    () =>
      resolveSelectedFactoryConfigSections({
        sections,
        selectedSectionIds,
      }),
    [sections, selectedSectionIds],
  );

  const multicall = useMemo(
    () =>
      factoryAddress
        ? buildFactoryConfigMulticall({
            factoryAddress,
            sections,
            selectedSectionIds,
          })
        : [],
    [factoryAddress, sections, selectedSectionIds],
  );

  const canSubmit =
    !!account &&
    !!factoryAddress &&
    manifestState.status === "ready" &&
    selectedSectionIds.length > 0 &&
    executionState.status !== "sending";
  const canSubmitOnCurrentNetwork = canSubmitFactoryConfigOnCurrentNetwork({
    hasWalletAccount: Boolean(account),
    connectedTxChain,
    targetChain: chain,
  });

  const isVersionCustomized = version !== defaultVersion;
  const executionTxHash =
    executionState.status === "submitted" || executionState.status === "confirmed" || executionState.status === "error"
      ? executionState.txHash
      : undefined;
  const txExplorerUrl = executionTxHash ? getFactoryExplorerTxUrl(chain, executionTxHash) : null;
  const targetChainLabel = getChainLabel(chain);

  const toggleSection = (sectionId: FactoryConfigSectionId) => {
    clearExecutionState();
    setSelectedSectionIds((currentSectionIds) =>
      currentSectionIds.includes(sectionId)
        ? currentSectionIds.filter((currentSectionId) => currentSectionId !== sectionId)
        : [...currentSectionIds, sectionId],
    );
  };

  const selectAllSections = () => {
    clearExecutionState();
    setSelectedSectionIds(listAllFactoryConfigSectionIds());
  };

  const clearSections = () => {
    clearExecutionState();
    setSelectedSectionIds([]);
  };

  const updateVersion = (nextVersion: string) => {
    clearExecutionState();
    setVersion(nextVersion);
  };

  const dismissSwitchNetworkPrompt = () => setShowSwitchNetworkPrompt(false);

  const requestNetworkSwitch = () => {
    if (!canSubmit) {
      return;
    }

    setShowSwitchNetworkPrompt(true);
  };

  const switchWalletToTargetChain = async () => {
    const switched = await switchWalletToChain({
      controller,
      targetChain: chain,
    });

    if (switched) {
      setShowSwitchNetworkPrompt(false);
    }
  };

  const confirmSubmittedMulticall = (txHash: string, attemptId: number) => {
    if (!account) {
      return;
    }

    void confirmFactoryConfigMulticall({
      account,
      txHash,
    })
      .then(() => {
        if (executionAttemptRef.current !== attemptId) {
          return;
        }

        setExecutionState((currentState) =>
          isPendingFactoryConfigExecutionState(currentState, txHash)
            ? buildConfirmedExecutionState(txHash)
            : currentState,
        );
      })
      .catch((error) => {
        if (executionAttemptRef.current !== attemptId) {
          return;
        }

        setExecutionState((currentState) =>
          isPendingFactoryConfigExecutionState(currentState, txHash)
            ? buildExecutionErrorState(error, txHash)
            : currentState,
        );
      });
  };

  const submitMulticall = async () => {
    if (!account || !canSubmit || multicall.length === 0) {
      return;
    }

    if (!canSubmitOnCurrentNetwork) {
      requestNetworkSwitch();
      return;
    }

    const attemptId = executionAttemptRef.current + 1;
    executionAttemptRef.current = attemptId;
    setExecutionState({ status: "sending" });

    try {
      const txHash = await submitFactoryConfigMulticall({
        account,
        multicall,
      });

      setExecutionState(buildSubmittedExecutionState(txHash));
      confirmSubmittedMulticall(txHash, attemptId);
    } catch (error) {
      setExecutionState(buildExecutionErrorState(error));
    }
  };

  return {
    account,
    draft,
    defaultVersion,
    selectedSectionIds,
    selectedSections,
    isManifestLoading: manifestState.status === "loading",
    manifestErrorMessage: manifestState.errorMessage,
    executionState,
    canSubmit,
    canSubmitOnCurrentNetwork,
    isVersionCustomized,
    txExplorerUrl,
    targetChainLabel,
    showSwitchNetworkPrompt,
    toggleSection,
    selectAllSections,
    clearSections,
    setVersion: updateVersion,
    dismissSwitchNetworkPrompt,
    switchWalletToTargetChain,
    submitMulticall,
  };
};
