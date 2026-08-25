import { resolveBlitzBalanceProfileIdFromDurationMinutes } from "@config";
import { useEffect, useState } from "react";
import {
  createFactoryMoreOptionsDraft,
  getFactoryMoreOptionSections,
  validateFactoryMoreOptions,
  type FactoryMoreOptionFieldId,
} from "../map-options";
import type { FactoryGameMode, FactoryLaunchChain } from "../types";

export const useFactoryV2MoreOptions = ({
  mode,
  chain,
  presetId,
  twoPlayerMode,
  durationMinutes,
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  presetId: string | null;
  twoPlayerMode: boolean;
  durationMinutes: number | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const blitzBalanceProfileId =
    mode === "blitz" ? resolveBlitzBalanceProfileIdFromDurationMinutes(durationMinutes) : null;
  const [draft, setDraft] = useState(() => createFactoryMoreOptionsDraft(mode, chain, durationMinutes));
  const visibility = { twoPlayerMode };

  useEffect(() => {
    setIsOpen(false);
    setDraft(createFactoryMoreOptionsDraft(mode, chain, durationMinutes));
  }, [blitzBalanceProfileId, chain, mode, presetId]);

  const validation = validateFactoryMoreOptions(mode, chain, draft, visibility, durationMinutes);

  return {
    isOpen,
    sections: getFactoryMoreOptionSections(mode, visibility, chain, durationMinutes),
    draft,
    errors: validation.errors,
    launchDisabledReason: validation.firstError,
    mapConfigOverrides: validation.mapConfigOverrides,
    blitzRegistrationOverrides: validation.blitzRegistrationOverrides,
    hasInvalidValues: validation.hasErrors,
    toggleOpen: () => setIsOpen((currentValue) => !currentValue),
    setValue: (fieldId: FactoryMoreOptionFieldId, value: string) => {
      setDraft((currentDraft) => ({
        ...currentDraft,
        [fieldId]: value,
      }));
    },
  };
};
