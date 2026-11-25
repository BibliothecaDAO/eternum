// @vitest-environment jsdom
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";

// The playtest's own step and its own browser read of the armies, not a second reader.
// The playtest's own step and its own browser read of the armies, not a second reader.
import { STEP_SETS } from "../../../../../scripts/client-playtest/steps.mjs";
import { ArmyCard } from "./army-row";
import { ArmyToken } from "./army-token";
import { PickedArmy } from "./picked-army";

const source = readFileSync("scripts/client-playtest/browser-session.mjs", "utf8");
const ARMIES_EXPRESSION = source.match(/const ARMIES_EXPRESSION = `([\s\S]*?)`;/)![1];

HTMLElement.prototype.checkVisibility = function (this: HTMLElement) {
  return this.closest("[hidden]") === null;
};

afterEach(() => {
  document.body.innerHTML = "";
});

const readPage = (expression: string) => JSON.parse(new Function(`return (${expression})`)() ?? "null");

const selectArmy = async () => {
  const clicked: string[] = [];
  const step = STEP_SETS.player.steps.find((each: { name: string }) => each.name === "select-army")!;
  const play = step.play as unknown as (input: { browser: object }) => Promise<unknown>;
  const armies = readPage(ARMIES_EXPRESSION);
  await play({ browser: { armies: () => armies, read: readPage, click: (name: string) => clicked.push(name) } });
  return { armies, clicked };
};

// Army 1 at 90 of 150 stamina, Army 2 at 100 of 200: Army 2 has more to act with, though less of its maximum.
const STAMINAS = [
  { current: 90, max: 150, perExplore: 20 },
  { current: 100, max: 200, perExplore: 20 },
];

it.each([
  ["a phone's tokens", ArmyToken],
  ["a desktop's cards", ArmyCard],
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
          troops={500}
          selected={false}
          onPick={() => {}}
        />
      ))}
    </nav>,
  );
  expect(await selectArmy()).toEqual({
    armies: [
      { label: "Army 1", stamina: 90 },
      { label: "Army 2", stamina: 100 },
    ],
    clicked: ["Army 2"],
  });
});

it("reads a phone's picked army from its tray while the dock under it is hidden, and leaves it picked", async () => {
  document.body.innerHTML = renderToStaticMarkup(
    <>
      <nav aria-label="Armies" hidden>
        <ArmyToken label="Army 1" art={undefined} stamina={STAMINAS[0]} troops={500} selected onPick={() => {}} />
      </nav>
      <PickedArmy
        army={{
          explorerId: 201,
          label: "Army 1",
          number: 1,
          art: "knight-t1",
          stamina: STAMINAS[0],
          secondsToFull: undefined,
          ethereal: undefined,
        }}
        refill={null}
        onDetails={() => {}}
      />
    </>,
  );
  expect(await selectArmy()).toEqual({ armies: [{ label: "Army 1", stamina: 90 }], clicked: [] });
});
