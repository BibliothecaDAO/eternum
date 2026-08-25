import { useEffect, useRef, useState, type MutableRefObject } from "react";

import {
  DEFAULT_FACTORY_DEVELOPER_CONTRACT_TARGET_ID,
  FACTORY_DEVELOPER_CONTRACT_TARGETS,
  findFactoryDeveloperContractTarget,
} from "../developer/contract-targets";
import { resolveFactoryManifestContractAddress } from "../developer/resolve-factory-manifest-contract-address";
import type {
  FactoryDeveloperContractTargetId,
  FactoryManifestContractLookupFailure,
  FactoryManifestContractLookupSuccess,
} from "../developer/types";
import type { FactoryLaunchChain } from "../types";

const DEV_TOOLS_STORAGE_KEY = "factory-v2-developer-tools-visible";
const DEV_TOOLS_TAP_WINDOW_MS = 2_000;
const DEV_TOOLS_TAP_COUNT = 5;
const COPY_STATUS_RESET_MS = 1_500;

function resolveDeveloperLookupGameNameSeed(selectedRunName: string | null, draftGameName: string): string {
  return selectedRunName?.trim() || draftGameName.trim();
}

export const useFactoryV2DeveloperLookup = ({
  chain,
  draftGameName,
  selectedRunName,
}: {
  chain: FactoryLaunchChain;
  draftGameName: string;
  selectedRunName: string | null;
}) => {
  const initialGameName = resolveDeveloperLookupGameNameSeed(selectedRunName, draftGameName);
  const [gameName, setGameName] = useState(initialGameName);
  const [selectedTargetId, setSelectedTargetId] = useState<FactoryDeveloperContractTargetId>(
    DEFAULT_FACTORY_DEVELOPER_CONTRACT_TARGET_ID,
  );
  const [customContractName, setCustomContractName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lookupResult, setLookupResult] = useState<FactoryManifestContractLookupSuccess | null>(null);
  const [lookupFailure, setLookupFailure] = useState<FactoryManifestContractLookupFailure | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const [worldAddressCopyStatus, setWorldAddressCopyStatus] = useState<"idle" | "copied" | "error">("idle");
  const lastGameNameSeedRef = useRef(initialGameName);
  const copyResetTimeoutRef = useRef<number | null>(null);
  const worldAddressCopyResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const nextGameNameSeed = resolveDeveloperLookupGameNameSeed(selectedRunName, draftGameName);
    if (!nextGameNameSeed || nextGameNameSeed === lastGameNameSeedRef.current) {
      return;
    }

    setGameName((currentGameName) =>
      currentGameName.trim().length === 0 || currentGameName === lastGameNameSeedRef.current
        ? nextGameNameSeed
        : currentGameName,
    );
    lastGameNameSeedRef.current = nextGameNameSeed;
  }, [draftGameName, selectedRunName]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current !== null) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }

      if (worldAddressCopyResetTimeoutRef.current !== null) {
        window.clearTimeout(worldAddressCopyResetTimeoutRef.current);
      }
    };
  }, []);

  const selectedTarget = findFactoryDeveloperContractTarget(selectedTargetId);
  const usesCustomContractInput = selectedTarget.allowsCustomInput;
  const contractName = selectedTarget.manifestTag ?? (usesCustomContractInput ? customContractName.trim() : "");
  const canSubmit = gameName.trim().length > 0 && contractName.trim().length > 0 && !isSubmitting;

  const runLookup = async (nextGameName: string, nextContractName: string) => {
    setIsSubmitting(true);
    setLookupResult(null);
    setLookupFailure(null);
    setCopyStatus("idle");
    setWorldAddressCopyStatus("idle");

    const result = await resolveFactoryManifestContractAddress({
      chain,
      worldName: nextGameName,
      manifestContractName: nextContractName,
    });

    if (result.kind === "success") {
      setLookupResult(result);
      setLookupFailure(null);
    } else {
      setLookupFailure(result);
      setLookupResult(null);
    }

    setIsSubmitting(false);
  };

  const submitLookup = async () => {
    if (!canSubmit) {
      return;
    }

    await runLookup(gameName.trim(), contractName.trim());
  };

  const applyWorldSuggestion = async (suggestedWorldName: string) => {
    setGameName(suggestedWorldName);
    await runLookup(suggestedWorldName, contractName.trim());
  };

  const applyContractSuggestion = async (suggestedManifestTag: string) => {
    const matchingTarget = FACTORY_DEVELOPER_CONTRACT_TARGETS.find(
      (target) => target.manifestTag === suggestedManifestTag,
    );

    if (matchingTarget) {
      setSelectedTargetId(matchingTarget.id);
      setCustomContractName("");
      await runLookup(gameName.trim(), matchingTarget.manifestTag ?? suggestedManifestTag);
      return;
    }

    setSelectedTargetId("custom");
    setCustomContractName(suggestedManifestTag);
    await runLookup(gameName.trim(), suggestedManifestTag);
  };

  const copyResolvedAddress = async () => {
    await copyLookupValue({
      value: lookupResult?.contractAddress,
      onStatusChange: setCopyStatus,
      resetTimeoutRef: copyResetTimeoutRef,
    });
  };

  const copyWorldAddress = async () => {
    await copyLookupValue({
      value: lookupResult?.worldAddress,
      onStatusChange: setWorldAddressCopyStatus,
      resetTimeoutRef: worldAddressCopyResetTimeoutRef,
    });
  };

  return {
    gameName,
    selectedTargetId,
    selectedTarget,
    customContractName,
    usesCustomContractInput,
    isSubmitting,
    canSubmit,
    lookupResult,
    lookupFailure,
    copyStatus,
    worldAddressCopyStatus,
    targetOptions: FACTORY_DEVELOPER_CONTRACT_TARGETS,
    setGameName,
    setSelectedTargetId,
    setCustomContractName,
    submitLookup,
    applyWorldSuggestion,
    applyContractSuggestion,
    copyResolvedAddress,
    copyWorldAddress,
  };
};

async function copyLookupValue({
  value,
  onStatusChange,
  resetTimeoutRef,
}: {
  value: string | null | undefined;
  onStatusChange: (status: "idle" | "copied" | "error") => void;
  resetTimeoutRef: MutableRefObject<number | null>;
}) {
  if (!value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(value);
    onStatusChange("copied");
  } catch {
    onStatusChange("error");
  }

  if (resetTimeoutRef.current !== null) {
    window.clearTimeout(resetTimeoutRef.current);
  }

  resetTimeoutRef.current = window.setTimeout(() => {
    onStatusChange("idle");
    resetTimeoutRef.current = null;
  }, COPY_STATUS_RESET_MS);
}
