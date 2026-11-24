import { readOpeningAdditions } from "@realms-world/identity";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  add: vi.fn<(additions: { reached: string[]; seen: string[] }) => Promise<{ reached: string[]; seen: string[] }>>(),
}));
vi.mock("@/hooks/context/identity-session", () => ({ identityClient: { addOpeningProgress: identity.add } }));

import { STANDING_PROMPTS } from "@/shell/standing-prompts";
import { OPENING_MOMENTS } from "./opening";
import { accountProgress, TUTORIAL_SKIPPED } from "./opening-state";
import {
  clearConfirmedTutorial,
  commitTutorialStep,
  flush,
  loadOpening,
  openingCacheKey,
  reachMoments,
  seeLine,
  skipTutorial,
  useOpeningStore,
} from "./opening-store";
import { SITE_ALERT_OFFER } from "./use-site-alert-offer";

/** A request the test answers when it chooses: the service's answer for it, or its failure. */
const unanswered: Array<() => void> = [];
const deferred = () => {
  const calls: Array<{
    sent: { reached: string[]; seen: string[] };
    answer: (held: { reached: string[]; seen: string[] }) => void;
    fail: () => void;
  }> = [];
  identity.add.mockImplementation(
    (sent) =>
      new Promise((answer, fail) => {
        calls.push({ sent, answer, fail: () => fail(new Error("unreachable")) });
        unanswered.push(() => fail(new Error("unreachable")));
      }),
  );
  return calls;
};
const unsent = () => {
  const { unsent: pending } = useOpeningStore.getState();
  return { reached: [...pending.reached].sort(), seen: [...pending.seen].sort() };
};
const settle = () => new Promise((done) => setTimeout(done, 0));

afterEach(async () => {
  // A request a test left in flight fails here, so the next test's first request is its own.
  for (const fail of unanswered.splice(0)) fail();
  await settle();
});

beforeEach(async () => {
  localStorage.clear();
  identity.add.mockReset();
  useOpeningStore.setState({
    owner: null,
    loaded: false,
    status: "signed-out",
    reached: new Set(),
    seen: new Set(),
    unsent: { reached: new Set(), seen: new Set() },
    showing: null,
    confirmed: null,
    onDevice: false,
  });
  await loadOpening(null);
});

it("keeps a change a failed request carried, and sends it again with the next request", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: [], seen: [] });
  await settle();
  void reachMoments(["launch"]);
  await settle();
  // Launch is in flight; fight is added behind it, and the in-flight request answers first.
  void reachMoments(["essence"]);
  calls[1]!.answer({ reached: ["launch"], seen: [] });
  await settle();
  expect(unsent()).toEqual({ reached: ["essence"], seen: [] });
  expect(calls[2]!.sent).toEqual({ reached: ["essence"], seen: [] });
  // Fight's request fails: it stays unsent, and nothing clears it but the answer that carries it.
  calls[2]!.fail();
  await settle();
  expect(unsent()).toEqual({ reached: ["essence"], seen: [] });
  void flush();
  await settle();
  expect(calls[3]!.sent).toEqual({ reached: ["essence"], seen: [] });
  calls[3]!.answer({ reached: ["essence", "launch"], seen: [] });
  await settle();
  expect(unsent()).toEqual({ reached: [], seen: [] });
});

it("serializes requests, so a late answer never clears what a later change added", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: [], seen: [] });
  await settle();
  void reachMoments(["launch"]);
  await settle();
  void reachMoments(["barracks"]);
  void seeLine("launch");
  await settle();
  // One request at a time: nothing else is sent while the first is unanswered.
  expect(calls).toHaveLength(2);
  calls[1]!.answer({ reached: ["launch"], seen: [] });
  await settle();
  expect(calls[2]!.sent).toEqual({ reached: ["barracks"], seen: ["launch"] });
  calls[2]!.answer({ reached: ["barracks", "launch"], seen: ["launch"] });
  await settle();
  expect(unsent()).toEqual({ reached: [], seen: [] });
});

it("opens a reload as the session left it, with its unsent change still to send", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: ["launch"], seen: [] });
  await settle();
  void reachMoments(["essence"]);
  await settle();
  calls[1]!.fail();
  await settle();
  // The page loads again: what the device kept is shown at once, before the service answers, and the fight is sent.
  useOpeningStore.setState({ owner: null, status: "signed-out", reached: new Set(), seen: new Set() });
  void loadOpening("a");
  const state = useOpeningStore.getState();
  expect([...state.reached].sort()).toEqual(["essence", "launch"]);
  expect(state.status).toBe("loading");
  await settle();
  expect(calls[2]!.sent).toEqual({ reached: ["essence"], seen: [] });
  calls[2]!.answer({ reached: ["essence", "launch"], seen: [] });
  await settle();
});

it("never lets one account's answer or progress reach another's", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  void loadOpening("b");
  await settle();
  // A's answer arrives after the switch: B's progress holds none of it.
  calls[0]!.answer({ reached: ["launch", "essence"], seen: ["launch"] });
  await settle();
  const state = useOpeningStore.getState();
  expect(state.owner).toBe("b");
  expect([...state.reached]).toEqual([]);
  expect(calls[1]!.sent).toEqual({ reached: [], seen: [] });
  calls[1]!.answer({ reached: [], seen: [] });
  await settle();
});

it("keeps sending after a flush while signed out: the account that signs in next is read and its progress sent", async () => {
  const calls = deferred();
  await flush();
  expect(calls).toHaveLength(0);
  void loadOpening("a");
  await settle();
  expect(calls).toHaveLength(1);
  calls[0]!.answer({ reached: ["launch"], seen: [] });
  await settle();
  expect(useOpeningStore.getState().status).toBe("ready");
  void seeLine("launch");
  await settle();
  expect(calls[1]!.sent).toEqual({ reached: [], seen: ["launch"] });
  calls[1]!.answer({ reached: ["launch"], seen: ["launch"] });
  await settle();
  expect(unsent()).toEqual({ reached: [], seen: [] });
});

it("says whether this device kept the account's progress: a cold load has none, a warm one has", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  expect(useOpeningStore.getState().onDevice).toBe(false);
  calls[0]!.answer({ reached: ["essence"], seen: [] });
  await settle();
  useOpeningStore.setState({ owner: null, status: "signed-out", reached: new Set(), seen: new Set() });
  void loadOpening("a");
  expect(useOpeningStore.getState().onDevice).toBe(true);
});

it("does not take a cache of this device's own additions for the account's progress after a reload", async () => {
  const calls = deferred();
  const reload = () => {
    useOpeningStore.setState({ owner: null, status: "signed-out", reached: new Set(), seen: new Set() });
    void loadOpening("a");
  };
  void loadOpening("a");
  await settle();
  // The read never answers; the HUD records what the realm's state reaches, and the device keeps it.
  void reachMoments(["launch", "barracks"]);
  await settle();
  reload();
  expect(accountProgress("a", useOpeningStore.getState()).ownsParts).toBe(false);
  // Once the service has answered, what the device keeps is the account's, and survives further additions.
  calls[0]!.answer({ reached: ["essence", "launch", "barracks"], seen: [] });
  await settle();
  void reachMoments(["essence"]);
  await settle();
  reload();
  expect(accountProgress("a", useOpeningStore.getState()).ownsParts).toBe(true);
});

it("keeps a skip final: no reload, sign-in or later lesson brings the tutorial back", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: [], seen: ["barracks"] });
  await settle();
  void skipTutorial();
  await settle();
  calls[1]!.answer({ reached: [], seen: ["barracks", TUTORIAL_SKIPPED] });
  await settle();

  useOpeningStore.setState({ owner: null, loaded: false, status: "signed-out", reached: new Set(), seen: new Set() });
  void loadOpening("a");
  await settle();
  calls[2]!.answer({ reached: [], seen: ["barracks", TUTORIAL_SKIPPED] });
  await settle();
  void seeLine("deploy");
  await settle();
  expect(accountProgress("a", useOpeningStore.getState()).seen.has(TUTORIAL_SKIPPED)).toBe(true);
});

it("follows the account, not the device: a second device shows no lesson until the server answers, then holds what the first completed", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: [], seen: [] });
  await settle();
  void seeLine("barracks");
  await settle();
  calls[1]!.answer({ reached: [], seen: ["barracks"] });
  await settle();

  localStorage.clear();
  useOpeningStore.setState({ owner: null, loaded: false, status: "signed-out", reached: new Set(), seen: new Set() });
  void loadOpening("a");
  await settle();
  expect(accountProgress("a", useOpeningStore.getState()).known).toBe(false);
  calls[2]!.answer({ reached: [], seen: ["barracks", "deploy"] });
  await settle();
  const secondDevice = accountProgress("a", useOpeningStore.getState());
  expect(secondDevice.known).toBe(true);
  expect([...secondDevice.seen].sort()).toEqual(["barracks", "deploy"]);
});

it("never lets a device's stale cache take away a lesson the server holds", async () => {
  localStorage.setItem(
    openingCacheKey("a"),
    JSON.stringify({ reached: [], seen: [], unsent: { reached: [], seen: [] }, complete: true }),
  );
  const calls = deferred();
  void loadOpening("a");
  await settle();
  expect(accountProgress("a", useOpeningStore.getState()).known).toBe(false);
  calls[0]!.answer({ reached: [], seen: ["explore"] });
  await settle();
  expect(accountProgress("a", useOpeningStore.getState()).seen.has("explore")).toBe(true);
});

it("keeps a signed-out player's progress on this device alone", async () => {
  await seeLine("barracks");
  useOpeningStore.setState({ owner: null, loaded: false, status: "signed-out", reached: new Set(), seen: new Set() });
  await loadOpening(null);
  expect(identity.add).not.toHaveBeenCalled();
  expect(accountProgress(null, useOpeningStore.getState())).toMatchObject({ known: true, seen: new Set(["barracks"]) });
});

it("sends only bodies the identity service's own validator takes, through every lesson, skip and a legacy key", async () => {
  const held = { reached: new Set<string>(), seen: new Set<string>() };
  const sent: unknown[] = [];
  identity.add.mockImplementation(async (body) => {
    const wire = JSON.parse(JSON.stringify(body));
    sent.push(wire);
    const additions = readOpeningAdditions(wire);
    if (!additions) throw new Error("400 invalid_opening_progress");
    additions.reached.forEach((moment) => held.reached.add(moment));
    additions.seen.forEach((moment) => held.seen.add(moment));
    return { reached: [...held.reached], seen: [...held.seen] };
  });
  localStorage.setItem(
    openingCacheKey("a"),
    JSON.stringify({ reached: [], seen: ["tutorial:skipped"], unsent: { reached: [], seen: ["tutorial:skipped"] } }),
  );

  await loadOpening("a");
  await reachMoments(OPENING_MOMENTS);
  for (const moment of OPENING_MOMENTS) await seeLine(moment);
  await skipTutorial();
  await commitTutorialStep({ completed: OPENING_MOMENTS, showing: null, confirmed: "barracks" });
  for (const prompt of [SITE_ALERT_OFFER, ...STANDING_PROMPTS]) await seeLine(prompt);
  await flush();

  expect(sent.length).toBeGreaterThan(0);
  expect(sent.filter((body) => readOpeningAdditions(body) === null)).toEqual([]);
  expect(useOpeningStore.getState().status).toBe("ready");
  expect(unsent()).toEqual({ reached: [], seen: [] });
  expect([...held.reached].sort()).toEqual([...OPENING_MOMENTS].sort());
  expect([...held.seen].sort()).toEqual(
    [...OPENING_MOMENTS, TUTORIAL_SKIPPED, SITE_ALERT_OFFER, ...STANDING_PROMPTS].sort(),
  );
});
