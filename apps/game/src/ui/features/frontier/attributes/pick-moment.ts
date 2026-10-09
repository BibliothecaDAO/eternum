import { AudioManager } from "@/audio/core/AudioManager";
import { playHaptic } from "@/ui/motion/motion-settings";
import { create } from "zustand";
import type { TierBoughtSystemUpdate } from "@bibliothecadao/eternum";
import type { Attribute } from "./attributes";

/**
 * The Upgrade: an army's four attributes as cards in the thumb zone, each priced at its next tier. The first tap lifts
 * a card and "Choose" commits it (a permanent purchase takes two taps). The chosen card flies into the army's badge when
 * the player's own TierBought story arrives; ArmyProgress stays the only fact for XP and tiers. Never a forced modal:
 * the panel opens from the army's chip and closes on "Later".
 */
type PickPhase = "choosing" | "committing" | "chosen" | "failed";

interface Pick {
  explorerId: number;
  lifted: Attribute | null;
  phase: PickPhase;
  error: string | null;
  chosen: TierBoughtSystemUpdate | null;
}

const usePickStore = create<{ pick: Pick | null }>(() => ({ pick: null }));

export const usePick = () => usePickStore((state) => state.pick);

const current = () => usePickStore.getState().pick;
const set = (pick: Pick | null) => usePickStore.setState({ pick });

export const openPick = (explorerId: number): void => {
  void AudioManager.getInstance().play("card.deal");
  set({ explorerId, lifted: null, phase: "choosing", error: null, chosen: null });
};

/** The first tap lifts a card; "Choose" then commits the lifted one. */
export const liftChoice = (attribute: Attribute): void => {
  const pick = current();
  if (!pick || (pick.phase !== "choosing" && pick.phase !== "failed")) return;
  set({ ...pick, lifted: attribute, phase: "choosing", error: null });
};

/** Sends the lifted Upgrade; a refusal returns the card with its reason. */
export const commitPick = (send: (attribute: Attribute) => Promise<void>): void => {
  const pick = current();
  if (!pick?.lifted || pick.phase !== "choosing") return;
  const attribute = pick.lifted;
  set({ ...pick, phase: "committing" });
  send(attribute).catch((error: unknown) => {
    const now = current();
    if (now?.explorerId !== pick.explorerId) return;
    set({ ...now, phase: "failed", error: error instanceof Error ? error.message : String(error) });
  });
};

/** The player's own TierBought for the open panel's army: the chosen card flies home. */
export const onTierBought = (story: TierBoughtSystemUpdate): void => {
  const pick = current();
  if (!pick || story.explorerId !== pick.explorerId || pick.phase !== "committing") return;
  void AudioManager.getInstance().play("card.pick");
  playHaptic(1);
  set({ ...pick, lifted: story.attribute, phase: "chosen", chosen: story });
};

/** The panel closes: after the flight, or on "Later". */
export const closePick = (): void => set(null);
