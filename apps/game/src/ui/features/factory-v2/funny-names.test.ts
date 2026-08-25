import { describe, expect, it } from "vitest";

import { buildFandomizedGameName } from "./funny-names";

const createSequenceRandom = (...values: number[]) => {
  let index = 0;

  return () => {
    const value = values[index] ?? values.at(-1) ?? 0;
    index += 1;
    return value;
  };
};

describe("factory v2 funny names", () => {
  it("builds a funny eternum name", () => {
    const name = buildFandomizedGameName("eternum", 3, createSequenceRandom(0, 0));

    expect(name).toBe("etrn-myth-1");
  });

  it("builds a funny blitz name", () => {
    const name = buildFandomizedGameName("blitz", 12, createSequenceRandom(0, 0.73));

    expect(name).toBe("bltz-flux-730");
  });
});
