import { expect, it } from "vitest";
import { createEndgameFixture, readEndgameSettings } from "./fixture";
it.each([false, true])("keeps terrain identical with and without discovered spires (busy=%s)", (busy) => {
  const settings = { ...readEndgameSettings(""), busy };
  const a = createEndgameFixture(settings),
    b = createEndgameFixture({ ...settings, spires: "awaken" });
  expect(a.request).toEqual(b.request);
  expect(a.request.cells).toHaveLength(busy ? 1008 : 320);
  for (const hex of a.spires) {
    expect(a.request.cells.find((p) => p.col === hex.col && p.row === hex.row)).toMatchObject({ explored: true });
  }
});
