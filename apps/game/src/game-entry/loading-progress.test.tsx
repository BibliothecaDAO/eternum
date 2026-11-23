import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";

import { advanceLoadingProgress, resetLoadingProgress, useMonotonicLoadingProgress } from "./loading-progress";

const Read = ({ percent }: { percent?: number }) => <output>{useMonotonicLoadingProgress(percent)}</output>;
const shown = (percent?: number) => renderToStaticMarkup(<Read percent={percent} />);

afterEach(() => {
  resetLoadingProgress();
});

it("only moves forward across handoffs until reset on return to the app shell", () => {
  expect(shown()).toBe("<output>0</output>");
  expect(advanceLoadingProgress(25)).toBe(25);
  expect(advanceLoadingProgress(10)).toBe(25);
  expect(shown(10)).toBe("<output>25</output>");
  expect(advanceLoadingProgress(72)).toBe(72);
  expect(shown()).toBe("<output>72</output>");
  expect(advanceLoadingProgress(0)).toBe(72);
  expect(advanceLoadingProgress(140)).toBe(100);
  resetLoadingProgress();
  expect(shown()).toBe("<output>0</output>");
  expect(advanceLoadingProgress(15)).toBe(15);
});
