import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DayDial } from "./day-dial";

it("counts down to the exact start instead of showing a nonpositive day", () => {
  const rules = { epochSeconds: 86400, startMainAt: 90000 };
  for (const now of [0, 86400, 89999]) {
    const html = renderToStaticMarkup(<DayDial rules={rules} now={now} />);
    expect(html).toContain('aria-label="Starts in ');
    expect(html).toContain("Soon");
  }
  expect(renderToStaticMarkup(<DayDial rules={rules} now={90000} />)).toContain('aria-label="Day 1,');
});
