import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ServiceFailure } from "@/ui/design-system/kit/service-failure";

const text = (markup: string) => new DOMParser().parseFromString(markup, "text/html").body.textContent ?? "";

describe("the failure owner", () => {
  it.each([
    ["directory", "Could not load games."],
    ["season", "Could not load Season."],
    ["results", "Could not load results."],
  ] as const)("names %s in its one line, with Try again on it", (service, line) => {
    const markup = renderToStaticMarkup(
      <ServiceFailure service={service} error={new Error("502 from shard-b")} retry={vi.fn()} />,
    );
    expect(text(markup)).toBe(`${line}Try again`);
    expect(markup).not.toContain("shard-b");
  });

  it("offers no step when there is nothing to try again", () => {
    expect(text(renderToStaticMarkup(<ServiceFailure service="season" error={null} />))).toBe("Could not load Season.");
  });
});
