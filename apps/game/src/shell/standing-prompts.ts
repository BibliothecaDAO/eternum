import { useEffect, useState } from "react";

import { notificationOwnerOf, useIdentitySession } from "@/hooks/context/identity-session";
import { loadOpening, seeLine, useOpeningStore } from "@/ui/features/frontier/opening/opening-store";

export const STANDING_PROMPTS = ["alerts-popup"] as const;
type StandingPrompt = (typeof STANDING_PROMPTS)[number];

const useUnanswered = (prompt: StandingPrompt): boolean => {
  const owner = notificationOwnerOf(useIdentitySession().session);
  useEffect(() => {
    void loadOpening(owner);
  }, [owner]);
  return useOpeningStore(
    (opening) => owner !== null && opening.owner === owner && opening.status === "ready" && !opening.seen.has(prompt),
  );
};

export const useStandingPrompt = (prompt: StandingPrompt, due: boolean): { open: boolean; close: () => void } => {
  const unanswered = useUnanswered(prompt);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!due) return setOpen(false);
    if (!unanswered) return;
    setOpen(true);
    void seeLine(prompt);
  }, [due, prompt, unanswered]);
  return { open: open && due, close: () => setOpen(false) };
};
