// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { seatSide } from "@/tokens";
import { SeatMark } from "./seat-mark";

describe("a player's seat mark on a list (side-colours-4)", () => {
  it("writes the player's initial on their seat colour, and nothing for nobody's or a playing viewer", () => {
    expect(renderToStaticMarkup(<SeatMark side={seatSide(0)} name=" kestrel" />)).toBe(
      '<span class="ui-seat" data-ink="dark" style="--seat:#fd7562" aria-hidden="true">K</span>',
    );
    expect(renderToStaticMarkup(<SeatMark side={seatSide(null)} name="The Vanguard" />)).toBe("");
    expect(renderToStaticMarkup(<SeatMark side={null} name="Kestrel" />)).toBe("");
    expect(renderToStaticMarkup(<SeatMark side={seatSide(2)} name="  " />)).toBe("");
  });
});
