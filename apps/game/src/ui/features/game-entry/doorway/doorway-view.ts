import type { PlayRouteBootPhase } from "@/game-entry/play-route-boot";

import { DEVICE_LIMIT_REACHED } from "@/hooks/context/gameplay-account-sync";
import { failureLine } from "@/shell/service-failure";

import type { BlitzEntry, GameEntryModalPhase } from "../game-entry-phase";

/** The doorway's track (design o5): the player's account, their realm, the world map, then play. */
export type DoorwayStep = "account" | "realm" | "map" | "play";
type StepState = "done" | "running" | "waiting";

/** Who is coming through: a player, whose realm is founded or prepared on the way, or a spectator. */
export type DoorwayAudience = "player" | "spectator";

/**
 * What holds the doorway until the player acts: a sign-in, a retry after the failure the owner words, or the device
 * limit with Devices as its step.
 */
type DoorwayBlocker = { kind: "sign-in" } | { kind: "retry"; line: string } | { kind: "devices" };

export interface DoorwayView {
  steps: { step: DoorwayStep; state: StepState }[];
  blocker: DoorwayBlocker | null;
  /** A Blitz the player is not on offers Watch; one that has ended offers its results. */
  spectating: "watch" | "results" | null;
}

/** The entry's side of the doorway: before the game's route, while the account and the realm come to be. */
interface EntrySide {
  source: "entry";
  phase: GameEntryModalPhase;
  audience: DoorwayAudience;
  signedIn: boolean;
  /** Founding the realm failed; its detail is in the console. */
  foundingFailed?: boolean;
  blitzEntry?: BlitzEntry | null;
}

/** The play route's side: the world map booting, then the hand-off to play. */
interface BootSide {
  source: "boot";
  phase: PlayRouteBootPhase;
  audience: DoorwayAudience;
  /** Why the gameplay account could not be set up, in words for the player, when it could not. */
  accountError?: string | null;
}

const SPECTATOR_STEPS: DoorwayStep[] = ["map", "play"];
const PLAYER_STEPS: DoorwayStep[] = ["account", "realm", "map", "play"];

const SIGN_IN: DoorwayBlocker = { kind: "sign-in" };
const WORLD_DID_NOT_ANSWER: DoorwayBlocker = { kind: "retry", line: failureLine("world") };

/**
 * The doorway, drawn from the two machines an entry already runs, the entry's phases and then the play route's boot.
 * It keeps no state of its own: the step each phase stands at, and what, if anything, waits on the player. The track
 * carries on across the navigation from the entry to the game's route, so it reads as one doorway.
 */
export const doorwayView = (side: EntrySide | BootSide): DoorwayView => {
  const steps = side.audience === "spectator" ? SPECTATOR_STEPS : PLAYER_STEPS;
  const found = side.source === "entry" ? entryPlace(side) : bootPlace(side);
  // A step the audience does not walk (a spectator's account) stands at the first one it does.
  const at = steps.includes(found.step) ? found : { ...found, step: steps[0] };
  return {
    steps: steps.map((step) => ({ step, state: stepState(step, at.step, at.done) })),
    blocker: at.blocker,
    spectating: at.spectating,
  };
};

interface Place {
  step: DoorwayStep;
  done: boolean;
  blocker: DoorwayBlocker | null;
  spectating: DoorwayView["spectating"];
}

const place = (step: DoorwayStep, overrides: Partial<Place> = {}): Place => ({
  step,
  done: false,
  blocker: null,
  spectating: null,
  ...overrides,
});

const entryPlace = ({ phase, signedIn, foundingFailed = false, blitzEntry }: EntrySide): Place => {
  switch (phase) {
    case "loading":
      return place("account");
    case "account":
      return place("account", { blocker: signedIn ? null : SIGN_IN });
    case "settlement-waiting":
      return place("realm");
    case "settlement":
      return place("realm", { blocker: foundingFailed ? WORLD_DID_NOT_ANSWER : null });
    case "spectate":
      return place("account", {
        done: true,
        spectating: blitzEntry === "review" ? "results" : "watch",
      });
    case "ready":
      // The realm stands; the entry now hands over to the game's route, where the map boots.
      return place("map");
    case "error":
      return place("account", { blocker: WORLD_DID_NOT_ANSWER });
  }
};

const bootPlace = ({ phase, accountError }: BootSide): Place => {
  switch (phase) {
    case "normalize_route":
    case "await_account":
      return place("account");
    case "reconnect_required":
      // Signed in but the account could not be set up: signing in again would not help; the device limit has its own
      // step, anything else trying again might.
      return place("account", { blocker: accountBlocker(accountError) });
    case "select_world":
    case "setup_game":
    case "initial_sync":
    case "seed_entry_state":
    case "init_renderer":
    case "wait_worldmap_ready":
      return place("map");
    case "handoff_scene":
      return place("play");
    case "ready":
      return place("play", { done: true });
    case "error":
      return place("map", { blocker: WORLD_DID_NOT_ANSWER });
  }
};

const accountBlocker = (accountError: string | null | undefined): DoorwayBlocker => {
  if (!accountError) return SIGN_IN;
  return accountError === DEVICE_LIMIT_REACHED ? { kind: "devices" } : { kind: "retry", line: accountError };
};

/** Steps before the one the entry stands at are done, the one it stands at runs until it is done, the rest wait. */
const stepState = (step: DoorwayStep, at: DoorwayStep, atDone: boolean): StepState => {
  const order = PLAYER_STEPS.indexOf(step) - PLAYER_STEPS.indexOf(at);
  if (order < 0 || (order === 0 && atDone)) return "done";
  return order === 0 ? "running" : "waiting";
};
