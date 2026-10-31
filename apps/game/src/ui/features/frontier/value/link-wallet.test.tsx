// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The account, the game's end and claim window, and the clock stand in; the prompt's rule and words are the real ones.
const world = vi.hoisted(() => ({
  session: null as null | { user: { address?: string } },
  now: 0,
  facts: {} as Record<string, unknown>,
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ session: world.session }) }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({ setup: { store: { get: (model: string) => world.facts[model] } } }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => world.now }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 1 }));

import { nativeRuleConstants } from "@bibliothecadao/eternum/game-client";
import { formatMoment } from "@bibliothecadao/types";
import { useLinkWalletPrompt } from "./link-wallet";

/** The season ends at 100,000 s; its claim window is 7 days. */
const END = 100_000;
const WEEK = 7 * 86_400;
const CLOSES = END + WEEK - nativeRuleConstants.FRONTIER_REPORT_GRACE_SECONDS;

let host: HTMLDivElement;
let root: Root;

const Prompt = ({ lords }: { lords: number | undefined }) => <p>{useLinkWalletPrompt(lords) ?? "none"}</p>;
const promptFor = (lords: number | undefined) => {
  act(() => root.render(<Prompt lords={lords} />));
  return host.textContent;
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  world.session = { user: {} };
  world.now = END - 3_600;
  world.facts = { GameRegistry: { end_at: END }, ChestRules: { claim_window_seconds: WEEK } };
  host = document.createElement("div");
  root = createRoot(host);
});

afterEach(() => act(() => root.unmount()));

it("tells an account with no linked wallet and LORDS to link one to receive them", () => {
  expect(promptFor(1_240)).toBe("Link a wallet to receive your LORDS");
});

it("says nothing to an account with a linked wallet, to a spectator, or about no LORDS", () => {
  world.session = { user: { address: "0x04a1" } };
  expect(promptFor(1_240)).toBe("none");
  world.session = null;
  expect(promptFor(1_240)).toBe("none");
  world.session = { user: {} };
  expect(promptFor(0)).toBe("none");
  expect(promptFor(undefined)).toBe("none");
});

it("gives the moment withdrawals close once the season is over, from the game's end and claim window", () => {
  world.now = END + 60;
  expect(promptFor(1_240)).toBe(
    `Link a wallet by ${formatMoment(CLOSES, END + 60)} or these LORDS go to the next season`,
  );
  // Before the game's rules are read, the line names no date it cannot know.
  world.facts = {};
  expect(promptFor(1_240)).toBe("Link a wallet to receive your LORDS");
});
