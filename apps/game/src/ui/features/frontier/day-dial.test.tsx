import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DayDial } from "./day-dial";

it("counts down to the exact start instead of showing a nonpositive day", () => {
  const rules = { dayUnitSeconds: 14_400, seed: 1n, startMainAt: 90000 };
  for (const now of [0, 86400, 89999]) {
    const html = renderToStaticMarkup(<DayDial rules={rules} now={now} />);
    expect(html).toContain('aria-label="Starts in ');
    expect(html).toContain("Soon");
  }
  expect(renderToStaticMarkup(<DayDial rules={rules} now={90000} />)).toContain('aria-label="Day 1,');
});

it("drains over today's own length: seed 1's 12-hour first day is half gone after six hours", () => {
  const rules = { dayUnitSeconds: 14_400, seed: 1n, startMainAt: 90000 };
  const html = renderToStaticMarkup(<DayDial rules={rules} now={90000 + 6 * 3600} />);
  expect(html).toContain('aria-label="Day 1, ');
  expect(html).toContain(`stroke-dashoffset="${2 * Math.PI * 16 * 0.5}"`);
});
