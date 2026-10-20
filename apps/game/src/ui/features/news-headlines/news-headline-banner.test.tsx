import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { NewsHeadlineBanner } from "./news-headline-banner";
import { buildCaptureHeadline } from "./capture-headline";
import type { Headline } from "./headline-types";

/** Identity's answer for the profiles asked, held until `answer` lets it through: a profile that answers late. */
const held: Array<() => void> = [];
const answer = () => held.splice(0).forEach((let_through) => let_through());
vi.stubGlobal(
  "fetch",
  (url: string) =>
    new Promise<Response>((resolve) => {
      const accounts = new URL(url).searchParams.get("accounts")!.split(",");
      const names: Record<string, string> = { "0x5eed0154": "jeanchristophemehrcl", "0x5eed0292": "Maelis" };
      held.push(() =>
        resolve(
          Response.json({
            profiles: Object.fromEntries(
              accounts.map((account) => [account, { name: names[account], portrait: null }]),
            ),
          }),
        ),
      );
    }),
);

const show = async (headline: Headline, check: (line: string) => void) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const line = () => container.querySelector(".ui-banner__line")!;
  try {
    await act(async () => root.render(<NewsHeadlineBanner headline={headline} onDismiss={() => undefined} />));
    // Waiting on identity: a muted bar where the name goes, never the account's stand-in "Lord ####".
    expect(line().textContent).not.toMatch(/Lord/);
    expect(line().querySelector("[aria-busy]")).not.toBeNull();
    await act(async () => {
      answer();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(line().querySelector("[aria-busy]")).toBeNull();
    check(line().textContent ?? "");
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
};

it("names an ended game's winner once identity answers, never by the stand-in name meanwhile (review P2-1)", async () => {
  await show(
    {
      id: "game-end:2",
      type: "game-end",
      icon: "game-end",
      title: "The game has ended",
      description: [{ player: 0x5eed0154n }, " wins!"],
      timestamp: 0,
    },
    (line) => expect(line).toBe("jeanchristophemehrcl wins!"),
  );
});

it("names both sides of a capture once identity answers, and the neutral side at once", async () => {
  await show(
    buildCaptureHeadline({
      structureId: 5,
      isHyperstructure: false,
      structureName: "Stolsli",
      previousOwner: 0x5eed0292n,
      newOwner: 0x5eed0154n,
      site: null,
      viewer: null,
      at: 0,
    }),
    (line) =>
      expect(line).toBe(
        "jeanchristophemehrcl took Stolsli from Maelis. Its armies and incoming deliveries went with it.",
      ),
  );
});
