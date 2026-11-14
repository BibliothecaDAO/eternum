import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { chainOf } from "@/lab/game/lab-chain";
import { questScenario } from "@/lab/game/quest-scenario";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { DailyQuest } from "./daily-quest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowSeconds: () => 350 }));
vi.mock("@/sync/action-outcome", () => ({
  untilApplied: async (sent: Promise<{ transaction_hash: string }>) => (await sent).transaction_hash,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});

function fixture(layout: "desktop" | "phone") {
  const scenario = questScenario();
  const store = chainOf(scenario);
  let finish!: (value: { transaction_hash: string }) => void;
  const submit = vi.fn(
    () =>
      new Promise<{ transaction_hash: string }>((resolve) => {
        finish = resolve;
      }),
  );
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const draw = () =>
    act(() =>
      root!.render(
        <GameProvider
          value={{ store, systemCalls: { claim_daily_quest: submit } } as unknown as GameClientSetup}
          account={{ address: scenario.player, account: { address: scenario.player } } as never}
        >
          <DailyQuest realm={store.require("Structure", { game_id: 1, entity_id: 7 })} layout={layout} />
        </GameProvider>,
      ),
    );
  return { store, draw, submit, finish: () => finish({ transaction_hash: "0x123" }), scenario };
}

const collect = () => [...host.querySelectorAll("button")].find((button) => button.textContent === "Collect");

describe.each(["desktop", "phone"] as const)("daily quest on %s", (layout) => {
  it("submits once, keeps Collect busy, and renders only the received grant as collected", async () => {
    const game = fixture(layout);
    game.draw();
    expect(collect()?.disabled).toBe(false);
    await act(async () => {
      collect()!.click();
    });
    expect(game.submit).toHaveBeenCalledTimes(1);
    expect(game.submit).toHaveBeenCalledWith(expect.objectContaining({ home: 7, day: 0 }));
    expect(host.textContent).toContain("Collecting…");
    expect(host.querySelector('[aria-label="Collected"]')).toBeNull();
    await act(async () => {
      game.store.applyFacts(
        game.scenario.answer(
          { kind: "ClaimDailyQuest", fields: { home: "7", day: "0" }, calldata: [] },
          game.store,
          350,
        ) as never,
      );
      game.finish();
    });
    expect(host.querySelector('[aria-label="Collected"]')).not.toBeNull();
    expect(collect()).toBeUndefined();
    expect(game.submit).toHaveBeenCalledTimes(1);
  });

  it("offers no Collect until a complete snapshot establishes the missing receipt and bonus", () => {
    const game = fixture(layout);
    game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: false, timestamp: 350 });
    game.draw();
    expect(host.textContent).toContain("Reading today's quest");
    expect(collect()).toBeUndefined();
    act(() => game.store.setSnapshot({ gameId: 1, actor: game.scenario.player, complete: true, timestamp: 350 }));
    expect(collect()?.disabled).toBe(false);
  });
});
