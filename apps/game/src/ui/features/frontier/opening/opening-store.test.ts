import { afterEach, beforeEach, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  add: vi.fn<(additions: { reached: string[]; seen: string[] }) => Promise<{ reached: string[]; seen: string[] }>>(),
}));
vi.mock("@/hooks/context/identity-session", () => ({ identityClient: { addOpeningProgress: identity.add } }));

import { accountProgress, TUTORIAL_SKIPPED } from "./opening-state";
import {
  flush,
  loadOpening,
  reachMoments,
  replayTutorial,
  seeLine,
  skipTutorial,
  useOpeningStore,
} from "./opening-store";

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
    status: "signed-out",
    reached: new Set(),
    seen: new Set(),
    unsent: { reached: new Set(), seen: new Set() },
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

it("persists skipTutorial and clears tutorial seen keys on replayTutorial without losing reached parts or non-tutorial prompts", async () => {
  const calls = deferred();
  void loadOpening("a");
  await settle();
  calls[0]!.answer({ reached: ["essence"], seen: ["barracks", "site-alert"] });
  await settle();

  void skipTutorial();
  await settle();
  calls[1]!.answer({ reached: ["essence"], seen: ["barracks", "site-alert", TUTORIAL_SKIPPED] });
  await settle();

  expect(accountProgress("a", useOpeningStore.getState()).seen.has(TUTORIAL_SKIPPED)).toBe(true);

  replayTutorial();
  const replayed = accountProgress("a", useOpeningStore.getState());
  expect(replayed.seen.has(TUTORIAL_SKIPPED)).toBe(false);
  expect(replayed.seen.has("barracks")).toBe(false);
  expect(replayed.seen.has("site-alert")).toBe(true);
  expect(replayed.reached.has("essence")).toBe(true);

  void seeLine("barracks");
  await settle();
  expect(accountProgress("a", useOpeningStore.getState()).seen.has("barracks")).toBe(true);
});
