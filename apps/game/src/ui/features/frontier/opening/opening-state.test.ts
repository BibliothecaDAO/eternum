import { expect, it } from "vitest";
import { isSeasonZeroPlayer } from "@/shell/season-tab/archive/archive";

import { OPENING_MOMENTS, type OpeningContext, type OpeningMoment } from "./opening";
import { OPENING_RULES } from "./opening-fixtures";
import {
  accountProgress,
  activeOpeningMoment,
  effectiveSeen,
  EMPTY_OPENING_CONTEXT,
  openedMoments,
  reachedOnContext,
  siteAlertOfferDue,
  stepTutorialMachine,
  TUTORIAL_SKIPPED,
} from "./opening-state";

it("reaches moments whose live context holds, in priority order", () => {
  expect(
    reachedOnContext({
      ...EMPTY_OPENING_CONTEXT,
      inEthereal: true,
      isCity: true,
      hasRelic: true,
      fragmentsSold: true,
      outOfStamina: true,
      hasOpenOathPick: true,
    }),
  ).toEqual(["oath", "spire", "shop", "relic", "city"]);
});

it("reaches no moment without a realm context and records lores and deep independently", () => {
  expect(reachedOnContext(null)).toEqual([]);
  expect(reachedOnContext(EMPTY_OPENING_CONTEXT)).toEqual([]);
  expect(reachedOnContext({ ...EMPTY_OPENING_CONTEXT, hasBarracks: true, inDeep: true })).toEqual([
    "deep",
    "aspects",
    "barracks",
  ]);
  expect(reachedOnContext({ ...EMPTY_OPENING_CONTEXT, hasWellLore: true, hasShrineLore: true })).toEqual([
    "well-lore",
    "shrine-lore",
  ]);
});

it("keeps a moment the account reached before although its state has passed, and drops unknown keys", () => {
  const opened = openedMoments(new Set(["essence", "not-a-moment"]), ["barracks"]);
  expect([...opened].sort()).toEqual(["barracks", "essence"]);
});

it("shows each contextual lesson only while its context holds and hides it automatically once completed", () => {
  const freshRealm = { ...EMPTY_OPENING_CONTEXT, hasRealm: true };
  expect(activeOpeningMoment(freshRealm, OPENING_RULES, new Set())).toBe("barracks");

  const afterBarracks = { ...freshRealm, hasBarracks: true, troopsAtHome: 2_000 };
  expect(activeOpeningMoment(afterBarracks, OPENING_RULES, new Set())).toBe("deploy");

  const afterDeploy = { ...afterBarracks, deployedArmies: 1 };
  expect(activeOpeningMoment(afterDeploy, OPENING_RULES, new Set())).toBe("explore");

  const afterExplore = { ...afterDeploy, hasExplored: true };
  expect(activeOpeningMoment(afterExplore, OPENING_RULES, new Set())).toBeNull();
});

it("prioritizes live high-context moments like oath and daily quest over early basics", () => {
  const ctx = {
    ...EMPTY_OPENING_CONTEXT,
    hasRealm: true,
    hasOpenOathPick: true,
    dailyQuestClaimable: true,
  };
  expect(activeOpeningMoment(ctx, OPENING_RULES, new Set())).toBe("oath");
  expect(activeOpeningMoment(ctx, OPENING_RULES, new Set(["oath"]))).toBe("daily-quest");
  expect(activeOpeningMoment(ctx, OPENING_RULES, new Set(["oath", "daily-quest"]))).toBe("barracks");
});

it("hides shop on testnet when fragments are not sold, and waits on deep rule data", () => {
  const testnetLowStamina = {
    ...EMPTY_OPENING_CONTEXT,
    hasRealm: true,
    hasBarracks: true,
    deployedArmies: 1,
    hasExplored: true,
    fragmentsSold: false,
    outOfStamina: true,
  };
  expect(activeOpeningMoment(testnetLowStamina, OPENING_RULES, new Set())).toBeNull();
  expect(activeOpeningMoment({ ...testnetLowStamina, fragmentsSold: true }, OPENING_RULES, new Set())).toBe("shop");

  const inDeep = { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, inDeep: true };
  expect(
    activeOpeningMoment(inDeep, { ...OPENING_RULES, deepLossPerTick: undefined }, new Set(["aspects"])),
  ).toBeNull();
});

it("holds own-Aspect lessons while HomeAspect is not yet synced, never defaulting to another Aspect", () => {
  const inDeep = { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, inDeep: true };
  expect(activeOpeningMoment(inDeep, { ...OPENING_RULES, ownAspect: undefined }, new Set())).toBeNull();
  const freshRealm = { ...EMPTY_OPENING_CONTEXT, hasRealm: true };
  expect(activeOpeningMoment(freshRealm, { ...OPENING_RULES, ownAspect: undefined }, new Set())).toBe("barracks");
});

it("identifies Season 0 veterans directly from the Season 0 archive regardless of zero padding", () => {
  expect(isSeasonZeroPlayer("0x45d6bd2bb5415e3fca5edd5dc00035510d165af218a92ed4cc44e58126d48d7")).toBe(true);
  expect(isSeasonZeroPlayer("0x045d6bd2bb5415e3fca5edd5dc00035510d165af218a92ed4cc44e58126d48d7")).toBe(true);
  expect(isSeasonZeroPlayer("0xdeadbeef")).toBe(false);
  expect(isSeasonZeroPlayer(null)).toBe(false);
});

it("auto-skips early basics for Season 0 veterans and welcomes them once", () => {
  const veteran = { ...EMPTY_OPENING_CONTEXT, hasRealm: true, isSeasonZeroVeteran: true };
  expect(activeOpeningMoment(veteran, OPENING_RULES, new Set())).toBe("season0-welcome");
  expect(activeOpeningMoment(veteran, OPENING_RULES, new Set(["season0-welcome"]))).toBeNull();
  expect(activeOpeningMoment({ ...veteran, hasActiveBane: true }, OPENING_RULES, new Set(["season0-welcome"]))).toBe(
    "bane",
  );
});

it("suppresses every tutorial line once skipped and restores them via effectiveSeen on replay", () => {
  const freshRealm = { ...EMPTY_OPENING_CONTEXT, hasRealm: true };
  const skipped = new Set([TUTORIAL_SKIPPED, "barracks"]);
  expect(activeOpeningMoment(freshRealm, OPENING_RULES, skipped)).toBeNull();
  const replayed = effectiveSeen(skipped, new Set([TUTORIAL_SKIPPED, "barracks"]));
  expect(activeOpeningMoment(freshRealm, OPENING_RULES, replayed)).toBe("barracks");
});

it("reads only the current account's progress, and calls it known only once its service has answered", () => {
  const progress = (owner: string | null, status: "signed-out" | "loading" | "ready" | "error", onDevice = false) => ({
    owner,
    status,
    reached: new Set(["essence"]),
    seen: new Set(["barracks"]),
    onDevice,
  });
  expect(accountProgress("a", progress("a", "loading")).known).toBe(false);
  expect(accountProgress("a", progress("a", "error")).known).toBe(false);
  expect(accountProgress("a", progress("a", "ready"))).toMatchObject({ known: true, seen: new Set(["barracks"]) });
  expect(accountProgress("b", progress("a", "ready"))).toEqual({
    reached: new Set(),
    seen: new Set(),
    known: false,
    ownsParts: false,
  });
  expect(accountProgress("a", progress("a", "loading")).ownsParts).toBe(false);
  expect(accountProgress("a", progress("a", "error")).ownsParts).toBe(false);
  expect(accountProgress("a", progress("a", "loading", true)).ownsParts).toBe(true);
  expect(accountProgress("a", progress("a", "ready")).ownsParts).toBe(true);
  expect(accountProgress(null, progress(null, "signed-out")).known).toBe(true);
});

it("makes the site alert's offer once the Deep is entered, until it is answered, whatever lines are told", () => {
  const entered = openedMoments(new Set(), ["deep"]);
  expect(siteAlertOfferDue(entered, new Set(), true, "site-alert")).toBe(true);
  expect(siteAlertOfferDue(entered, new Set(["barracks"]), true, "site-alert")).toBe(true);
  expect(siteAlertOfferDue(entered, new Set(), false, "site-alert")).toBe(false);
  expect(siteAlertOfferDue(entered, new Set(["site-alert"]), true, "site-alert")).toBe(false);
  expect(siteAlertOfferDue(openedMoments(new Set(), ["barracks"]), new Set(), true, "site-alert")).toBe(false);
});

const LIFECYCLE_CASES: Record<OpeningMoment, { due: OpeningContext; completed?: OpeningContext }> = {
  "season0-welcome": {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, isSeasonZeroVeteran: true },
  },
  oath: {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasOpenOathPick: true },
    completed: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasOpenOathPick: false, hasSwornOath: true },
  },
  bane: {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasActiveBane: true },
    completed: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasActiveBane: false },
  },
  deep: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      inDeep: true,
    },
  },
  aspects: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hyperstructureAdvanced: true,
    },
  },
  spire: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      inEthereal: true,
    },
  },
  "daily-quest": {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      dailyQuestClaimable: true,
    },
    completed: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      dailyQuestClaimed: true,
    },
  },
  essence: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hasEssence: true,
    },
    completed: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hasEssence: true,
      hasResearched: true,
    },
  },
  shop: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      fragmentsSold: true,
      outOfStamina: true,
    },
  },
  relic: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hasRelic: true,
    },
  },
  "well-lore": {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hasWellLore: true,
    },
  },
  "shrine-lore": {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      hasShrineLore: true,
    },
  },
  city: {
    due: {
      ...EMPTY_OPENING_CONTEXT,
      hasRealm: true,
      hasBarracks: true,
      deployedArmies: 1,
      hasExplored: true,
      isCity: true,
    },
  },
  barracks: {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true },
    completed: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true },
  },
  deploy: {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, troopsAtHome: 2_000 },
    completed: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, troopsAtHome: 1_000, deployedArmies: 1 },
  },
  explore: {
    due: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, deployedArmies: 1, hasExplored: false },
    completed: { ...EMPTY_OPENING_CONTEXT, hasRealm: true, hasBarracks: true, deployedArmies: 1, hasExplored: true },
  },
};

it("runs every lesson through due -> showing -> completed or dismissed -> never again -> replay", () => {
  for (const moment of OPENING_MOMENTS) {
    const scenario = LIFECYCLE_CASES[moment];
    const shown = stepTutorialMachine({
      showing: null,
      confirmed: null,
      ctx: scenario.due,
      rules: OPENING_RULES,
      seen: new Set(),
    });
    expect(shown.nextShowing, `${moment} should become showing`).toBe(moment);
    expect(shown.confirmedMoment).toBeNull();

    const persisted = new Set<string>(shown.newlyCompleted);
    if (scenario.completed) {
      const finished = stepTutorialMachine({
        showing: moment,
        confirmed: null,
        ctx: scenario.completed,
        rules: OPENING_RULES,
        seen: persisted,
      });
      expect(finished.confirmedMoment, `${moment} should confirm on completion`).toBe(moment);
      expect(finished.nextShowing).toBeNull();
      expect(finished.newlyCompleted).toContain(moment);
      for (const done of finished.newlyCompleted) persisted.add(done);
    } else {
      persisted.add(moment);
    }

    const afterDone = stepTutorialMachine({
      showing: null,
      confirmed: null,
      ctx: scenario.due,
      rules: OPENING_RULES,
      seen: persisted,
    });
    expect(afterDone.nextShowing, `${moment} must not return once completed or dismissed`).not.toBe(moment);
    expect(afterDone.confirmedMoment).toBeNull();

    const replayed = effectiveSeen(persisted, new Set([moment]));
    const afterReplay = stepTutorialMachine({
      showing: null,
      confirmed: null,
      ctx: scenario.due,
      rules: OPENING_RULES,
      seen: replayed,
      replayed: new Set([moment]),
    });
    expect(afterReplay.nextShowing, `${moment} must return after Replay`).toBe(moment);
  }
});

it("silently completes actions done before their lesson showed without flashing a confirmation banner, and keeps replay intact", () => {
  const alreadyDeployed: OpeningContext = {
    ...EMPTY_OPENING_CONTEXT,
    hasRealm: true,
    hasBarracks: true,
    deployedArmies: 1,
    hasExplored: false,
  };
  const silent = stepTutorialMachine({
    showing: null,
    confirmed: null,
    ctx: alreadyDeployed,
    rules: OPENING_RULES,
    seen: new Set(),
  });
  expect(silent.confirmedMoment).toBeNull();
  expect(silent.newlyCompleted).toEqual(["barracks", "deploy"]);
  expect(silent.nextShowing).toBe("explore");

  const replayed = new Set<string>(["barracks", "deploy", "explore"]);
  const whileStandingOnDoneRealm = stepTutorialMachine({
    showing: null,
    confirmed: null,
    ctx: { ...alreadyDeployed, hasExplored: true },
    rules: OPENING_RULES,
    seen: new Set(),
    replayed,
  });
  expect(whileStandingOnDoneRealm.newlyCompleted).toEqual([]);
  expect(whileStandingOnDoneRealm.nextShowing).toBeNull();
});

it("clears showing and confirmed immediately once tutorial is skipped", () => {
  const skipped = stepTutorialMachine({
    showing: "explore",
    confirmed: "barracks",
    ctx: LIFECYCLE_CASES.explore.due,
    rules: OPENING_RULES,
    seen: new Set([TUTORIAL_SKIPPED]),
  });
  expect(skipped).toEqual({ nextShowing: null, confirmedMoment: null, newlyCompleted: [] });
});
