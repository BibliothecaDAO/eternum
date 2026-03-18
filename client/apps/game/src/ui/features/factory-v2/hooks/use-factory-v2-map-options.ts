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
}: {
  mode: FactoryGameMode;
  chain: FactoryLaunchChain;
  presetId: string | null;
  twoPlayerMode: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(() => createFactoryMoreOptionsDraft(mode, chain));
  const visibility = { twoPlayerMode };

  useEffect(() => {
    setIsOpen(false);
    setDraft(createFactoryMoreOptionsDraft(mode, chain));
  }, [chain, mode, presetId]);

  const validation = validateFactoryMoreOptions(mode, chain, draft, visibility);

  return {
    isOpen,
    sections: getFactoryMoreOptionSections(mode, visibility),
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

export const useFactoryV2MapOptions = useFactoryV2MoreOptions;
