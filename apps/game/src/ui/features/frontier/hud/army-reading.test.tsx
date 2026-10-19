// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";

// The playtest's own step and its own browser read of the armies, not a second reader.
import { STEP_SETS } from "../../../../../scripts/client-playtest/steps.mjs";
import { ArmyRow } from "./army-row";
import { ArmyToken } from "./army-token";

const source = readFileSync("scripts/client-playtest/browser-session.mjs", "utf8");
const ARMIES_EXPRESSION = source.match(/const ARMIES_EXPRESSION = `([\s\S]*?)`;/)![1];

afterEach(() => {
  document.body.innerHTML = "";
});

// Army 1 at 90 of 150 stamina, Army 2 at 100 of 200: Army 2 has more to act with, though less of its maximum.
const STAMINAS = [
  { current: 90, max: 150 },
  { current: 100, max: 200 },
];

it.each([
  ["a phone's tokens", ArmyToken],
  ["a desktop's rows", ArmyRow],
] as const)("reads each army's exact stamina from %s, and the player picks the army with the most", async (_, Army) => {
  document.body.innerHTML = renderToStaticMarkup(
    <nav aria-label="Armies">
      {STAMINAS.map((stamina, index) => (
        <Army
          key={index}
          number={index + 1}
          label={`Army ${index + 1}`}
          art={undefined}
          stamina={stamina}
          xp={0}
          troops={500}
          canBuyTier={false}
          selected={false}
          onPick={() => {}}
        />
      ))}
    </nav>,
  );
  const armies = JSON.parse(new Function(`return (${ARMIES_EXPRESSION})`)());
  const clicked: string[] = [];
  // The step as the runner plays it, given only the browser it reads and clicks.
  const step = STEP_SETS.player.steps.find((each: { name: string }) => each.name === "select-army")!;
  const play = step.play as unknown as (input: { browser: object }) => Promise<unknown>;
  await play({ browser: { armies: () => armies, click: (name: string) => clicked.push(name) } });
  expect({ armies, clicked }).toEqual({
    armies: [
      { label: "Army 1", stamina: 90 },
      { label: "Army 2", stamina: 100 },
    ],
    clicked: ["Army 2"],
  });
});
