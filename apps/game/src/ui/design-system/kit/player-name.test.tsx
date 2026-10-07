import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const profiles = vi.hoisted(() => new Map<string, { name: string | null; portrait: string | null }>());
vi.mock("@/hooks/use-player-profile", () => ({
  usePlayerProfile: (account: string) => profiles.get(account) ?? { name: null, portrait: null },
}));

import { unclaimedPlayerName } from "@bibliothecadao/eternum";

import { PlayerName } from "./player-name";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

describe("the one name rule", () => {
  it("names an unclaimed account Lord and its last four, padded and in either case", () => {
    expect(unclaimedPlayerName("0x03F2A9C1D")).toBe("Lord 9c1d");
    expect(unclaimedPlayerName("0x000000000000000000000000000000000000000000000000000000000000003f")).toBe("Lord 003f");
    expect(unclaimedPlayerName(0x3f2an)).toBe("Lord 3f2a");
  });

  it("draws the claimed name in the plain tone", () => {
    profiles.set("0xa1", { name: "Maelis", portrait: null });
    const markup = renderToStaticMarkup(<PlayerName account="0xa1" />);
    expect(text(markup)).toBe("Maelis");
    expect(markup).not.toContain("text-kit-muted");
  });

  it("draws an unclaimed player as Lord and the last four in the muted tone, never the address", () => {
    const markup = renderToStaticMarkup(<PlayerName account="0x3f2a9c1d" />);
    expect(text(markup)).toBe("Lord 9c1d");
    expect(markup).toContain("text-kit-muted");
    expect(markup).not.toContain("0x3f2a");
  });

  it("calls the player You on a list, with the portrait on the peach ring", () => {
    profiles.set("0xb2", { name: "Aldric", portrait: "03" });
    const markup = renderToStaticMarkup(<PlayerName account="0xb2" you portrait />);
    expect(text(markup)).toBe("You");
    expect(markup).toContain('src="/images/avatars/03.png"');
    expect(markup).toContain("border-kit-peach");
  });
});
