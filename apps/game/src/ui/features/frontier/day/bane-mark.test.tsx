import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { useNamedTips } from "@/ui/design-system/kit/named-tips";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArmyDetail } from "../army/army-panel";
import { ArmyCard } from "../hud/army-row";
import { RealmCard } from "../hud/realm-card";
import type { StoreReading } from "../hud/status-strip";
import { StoreCard, type StoreLine } from "../production/store-card";
import { FightArena } from "../sites/fight-side";
import type { BaneFigure } from "./bane-face";
import { BaneDayProvider } from "./bane-mark";

const day = vi.hoisted(() => ({ today: null as null | { figure: string; mark: string; line: string; icon: string } }));
vi.mock("./bane-face", async (original) => ({
  ...(await original<typeof import("./bane-face")>()),
  useBaneToday: () => day.today,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  day.today = null;
  useTooltipStore.getState().setTooltip(null);
});

const LINES: Record<BaneFigure, { mark: string; line: string }> = {
  production: { mark: "▾", line: "Ash Fall: production 50% until broken or 02:13" },
  stamina: { mark: "▾", line: "Mist Tide: stamina regen 50% until broken or 02:13" },
  guards: { mark: "▲", line: "Blood Moon: guard strength 150% until broken or 02:13" },
  height: { mark: "▾", line: "Prowess bane: Deep height paused until broken or 02:13" },
};

const onBaneDay = (figure: BaneFigure | null) => {
  day.today = figure && { figure, ...LINES[figure], icon: "bane-world" };
};

const NamedTips = () => {
  useNamedTips();
  return null;
};

const draw = (node: ReactNode) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <BaneDayProvider realm={null}>
        <NamedTips />
        {node}
      </BaneDayProvider>,
    ),
  );
};

const wheat: StoreReading = {
  kind: "wheat",
  amount: 6_352,
  limit: 18_000,
  perHour: 300,
  fullIn: 40_000,
  tone: "calm",
  flyTarget: "wheat",
};

const wheatLine: StoreLine = {
  kind: "wheat",
  perHour: 300,
  held: 6_352,
  limit: 18_000,
  tone: "calm",
  fullIn: 40_000,
  noBuilding: false,
  makers: ["2 Farms +5/min"],
};

const everyFigure = (
  <>
    <RealmCard name="Num" kind="realm" level={1} stores={[wheat]} fragments={0} lords={0} />
    <StoreCard line={wheatLine} onSpend={() => undefined} onBuild={() => undefined} />
    <ArmyCard label="Knights" number={1} art="troops" stamina={{ current: 42, max: 180, perExplore: 20 }} selected={false} />
    <ArmyDetail army={{ art: "troops", troops: 50, stamina: { current: 42, max: 180, perExplore: 20 }, secondsToFull: 24_000 }} />
    <FightArena
      ours={{ label: "Army", mark: null, before: 500, kept: 458 }}
      theirs={{ label: "Cyclops", mark: null, before: 180, kept: 0, bane: "guards" }}
    />
  </>
);

const marked = (figure: BaneFigure) =>
  [...host.querySelectorAll(`[data-bane-figure="${figure}"]`)].map((node) => node.textContent);

const hover = (element: Element) => {
  const over = new MouseEvent("pointerover", { bubbles: true });
  Object.defineProperty(over, "pointerType", { value: "mouse" });
  act(() => element.dispatchEvent(over));
  const tip = document.createElement("div");
  const tipRoot = createRoot(tip);
  act(() => tipRoot.render(<>{useTooltipStore.getState().tooltip?.content}</>));
  const lines = [...tip.querySelectorAll(".ui-tip__line")].map((line) => line.textContent);
  act(() => tipRoot.unmount());
  return lines;
};

describe("a bane day on the figures it cuts", () => {
  it("marks each production figure crimson with ▾ on Ash Fall, and no other figure", () => {
    onBaneDay("production");
    draw(everyFigure);
    expect(marked("production")).toEqual(["+5/min▾", "+5/min▾", "2 Farms +5/min▾"]);
    expect(marked("stamina")).toEqual([]);
    expect(marked("guards")).toEqual([]);
    expect(host.querySelector('[data-bane-line="production"]')?.textContent).toBe(LINES.production.line);
  });

  it("marks the stamina figures on Mist Tide: the row, the panel's bar and its Full in, with the line in the panel", () => {
    onBaneDay("stamina");
    draw(everyFigure);
    expect(marked("stamina")).toEqual(["42/180▾", "Full in 6h 40m▾", "42/180▾"]);
    expect(marked("production")).toEqual([]);
    expect(host.querySelector('[data-bane-line="stamina"]')?.textContent).toBe(LINES.stamina.line);
  });

  it("marks a full bar's figure nowhere, since the bane slows only what is still filling", () => {
    onBaneDay("stamina");
    draw(<ArmyCard label="Knights" number={1} art="troops" stamina={{ current: 180, max: 180, perExplore: 20 }} selected={false} />);
    expect(marked("stamina")).toEqual([]);
  });

  it("marks the beast's strength ▲ on Blood Moon, never the army's own figures", () => {
    onBaneDay("guards");
    draw(everyFigure);
    expect(marked("guards")).toEqual(["180▲"]);
    expect(host.querySelector('[data-fight-side="ours"] [data-bane-figure]')).toBeNull();
  });

  it("marks nothing on a calm day or a bane that cuts no HUD figure", () => {
    for (const figure of [null, "height"] as const) {
      onBaneDay(figure);
      draw(everyFigure);
      expect(host.querySelectorAll("[data-bane-figure], [data-bane-line]")).toHaveLength(0);
      act(() => root?.unmount());
      host.remove();
    }
    root = undefined;
  });

  it("adds the bane's line under a cut figure's own tooltip, and says it alone where the figure had none", () => {
    onBaneDay("production");
    draw(everyFigure);
    expect(hover(host.querySelector('[data-store="wheat"] [data-bane-figure]')!)).toEqual([
      "Wheat 6,352 of 18,000 · +5/min · Full in 11h 6m",
      LINES.production.line,
    ]);
    expect(hover(host.querySelector('[data-store-card="wheat"] [data-bane-figure]')!)).toEqual([
      LINES.production.line,
    ]);
  });
});
