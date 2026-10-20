// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

/**
 * Identity, per account, held until `answer` lets it through: 0x5eed0789's ask fails, 0x5eed0154 answers with no
 * claimed name, 0x5eed0292 with "Maelis".
 */
const held = vi.hoisted(() => [] as Array<() => void>);
vi.mock("@realms-world/identity", async (original) => ({
  ...(await original<typeof import("@realms-world/identity")>()),
  fetchIdentityProfiles: (_origin: string, accounts: string[]) =>
    new Promise((resolve, reject) =>
      held.push(() =>
        accounts.includes("0x5eed0789")
          ? reject(new Error("identity 503"))
          : resolve(
              Object.fromEntries(
                accounts.map((account) => [
                  account,
                  { name: account === "0x5eed0292" ? "Maelis" : null, portrait: null },
                ]),
              ),
            ),
      ),
    ),
}));

import { displayPlayerName } from "@bibliothecadao/eternum";
import { usePlayerDisplayName } from "@/hooks/use-player-profile";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { HeadlineLine } from "@/ui/features/news-headlines/headline-line";

import { getPlayerDisplayName, readPlayerName } from "./player-profiles";

const FAILED = "0x5eed0789";
const UNCLAIMED = "0x5eed0154";
const CLAIMED = "0x5eed0292";

/** What each kind of reader writes for one player: the one rule's reading, then every reader of it. */
const readers = (address: string, drawn: Record<string, string>) => ({
  reading: readPlayerName(address).state,
  // The 3D army and structure labels, the Season board's rows, raid results, the event feed's entity reader.
  imperative: getPlayerDisplayName(address),
  // The game client's views and stories, through the resolver they are handed (`PlayerNameResolver`).
  core: displayPlayerName(address, getPlayerDisplayName(address)),
  ...drawn,
});

it("names a player one way on every reader: waiting, then their name, the unclaimed rule, or unavailable (whole-review P3-1)", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const Hook = ({ address }: { address: string }) => <i data-hook={address}>{usePlayerDisplayName(address)}</i>;
  const draw = () =>
    act(async () =>
      root.render(
        <>
          {[FAILED, UNCLAIMED, CLAIMED].map((address) => (
            <p key={address} data-row={address}>
              <Hook address={address} />
              <b data-kit>
                <PlayerName account={address} />
              </b>
              <s data-headline>
                <HeadlineLine parts={[{ player: BigInt(address) }]} />
              </s>
            </p>
          ))}
        </>,
      ),
    );
  const drawn = (address: string) => {
    const row = host.querySelector(`[data-row="${address}"]`)!;
    return {
      hook: row.querySelector("[data-hook]")!.textContent!,
      kit: row.querySelector("[data-kit]")!.textContent!,
      headline: row.querySelector("[data-headline]")!.textContent!,
    };
  };
  try {
    // The failing account is asked on its own, as a player seen first and alone would be: one failed request leaves
    // unavailable only the accounts it asked for.
    readPlayerName(FAILED);
    await Promise.resolve();
    await draw();
    // Nobody has answered: every reader waits, none writes the stand-in.
    for (const address of [FAILED, UNCLAIMED, CLAIMED])
      expect(readers(address, drawn(address))).toEqual({
        reading: "waiting",
        imperative: "…",
        core: "…",
        hook: "…",
        kit: "",
        headline: "…",
      });
    await act(async () => {
      held.splice(0).forEach((let_through) => let_through());
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(readers(FAILED, drawn(FAILED))).toEqual({
      reading: "unavailable",
      imperative: "—",
      core: "—",
      hook: "—",
      kit: "—",
      headline: "—",
    });
    expect(readers(UNCLAIMED, drawn(UNCLAIMED))).toEqual({
      reading: "named",
      imperative: "Lord 0154",
      core: "Lord 0154",
      hook: "Lord 0154",
      kit: "Lord 0154",
      headline: "Lord 0154",
    });
    expect(readers(CLAIMED, drawn(CLAIMED))).toEqual({
      reading: "named",
      imperative: "Maelis",
      core: "Maelis",
      hook: "Maelis",
      kit: "Maelis",
      headline: "Maelis",
    });
    // The zero address is the neutral side, with nothing to ask.
    expect(getPlayerDisplayName(0n)).toBe("The Vanguard");
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
