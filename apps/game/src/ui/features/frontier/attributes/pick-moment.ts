import { AudioManager } from "@/audio/core/AudioManager";
import { playHaptic } from "@/ui/motion/motion-settings";
import { create } from "zustand";
import type { AttributeChosenSystemUpdate } from "@bibliothecadao/eternum";
import type { Attribute, AttributeOfferFacts } from "./attributes";

/**
 * Design §3.11 §2, the pick: an army's pending offer as three cards in the thumb zone. The first tap lifts a card and
 * "Choose" commits it (a permanent pick takes two taps). The chosen card flies into the army's badge when the player's
 * own AttributeChosen story arrives; ArmyProgress stays the only fact for levels and the offer, and an offer that leaves
 * it closes the panel however the result came. Never a forced modal: "Later" leaves the offer waiting on its army.
 */
type PickPhase = "choosing" | "committing" | "chosen" | "failed";

interface Pick {
  explorerId: number;
  offer: AttributeOfferFacts;
  lifted: Attribute | null;
  phase: PickPhase;
  error: string | null;
  chosen: AttributeChosenSystemUpdate | null;
}

const usePickStore = create<{ pick: Pick | null }>(() => ({ pick: null }));

export const usePick = () => usePickStore((state) => state.pick);

const current = () => usePickStore.getState().pick;
const set = (pick: Pick | null) => usePickStore.setState({ pick });

let autoOpened = false;

/**
 * A Shrine's offer opens the panel at once, every time: the player used the Shrine to pick. The session's first
 * level-up opens it too; every other offer waits on its army's chip.
 */
export const shouldAutoOpenPick = (offer: AttributeOfferFacts): boolean => {
  if (offer.source === "Shrine") return true;
  if (autoOpened || offer.source !== "Level") return false;
  autoOpened = true;
  return true;
};

export const openPick = (explorerId: number, offer: AttributeOfferFacts): void => {
  void AudioManager.getInstance().play("card.deal");
  set({ explorerId, offer, lifted: null, phase: "choosing", error: null, chosen: null });
};

/** The first tap lifts a card; "Choose" then commits the lifted one. */
export const liftChoice = (attribute: Attribute): void => {
  const pick = current();
  if (!pick || (pick.phase !== "choosing" && pick.phase !== "failed")) return;
  set({ ...pick, lifted: attribute, phase: "choosing", error: null });
};

/** Sends the lifted choice; a refusal returns the card with its reason, and the offer stays. */
export const commitPick = (send: (attribute: Attribute) => Promise<void>): void => {
  const pick = current();
  if (!pick?.lifted || pick.phase !== "choosing") return;
  const attribute = pick.lifted;
  set({ ...pick, phase: "committing" });
  send(attribute).catch((error: unknown) => {
    const now = current();
    if (now?.offer.id !== pick.offer.id) return;
    set({ ...now, phase: "failed", error: error instanceof Error ? error.message : String(error) });
  });
};

/** The player's own AttributeChosen: the chosen card flies home. */
export const onAttributeChosen = (story: AttributeChosenSystemUpdate): void => {
  const pick = current();
  if (!pick || story.explorerId !== pick.explorerId || story.offerId !== pick.offer.id) return;
  void AudioManager.getInstance().play("card.pick");
  playHaptic(1);
  set({ ...pick, lifted: story.attribute, phase: "chosen", chosen: story });
};

/** The panel closes: after the flight, on "Later", or when the offer is no longer pending. */
export const closePick = (): void => set(null);
