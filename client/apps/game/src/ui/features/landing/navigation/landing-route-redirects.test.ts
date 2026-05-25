import { describe, expect, it } from "vitest";

import { resolveLegacyLandingHref } from "./landing-route-redirects";

const createLocation = (pathname: string, search = ""): Location => ({ pathname, search }) as Location;

describe("resolveLegacyLandingHref", () => {
  it("redirects home tab URLs to explicit landing routes", () => {
    expect(resolveLegacyLandingHref(createLocation("/", "?tab=learn"))).toBe("/learn");
    expect(resolveLegacyLandingHref(createLocation("/", "?tab=news"))).toBe("/news");
    expect(resolveLegacyLandingHref(createLocation("/", "?tab=factory"))).toBe("/factory");
  });

  it("keeps unrelated query params when redirecting", () => {
    expect(resolveLegacyLandingHref(createLocation("/", "?tab=learn&ref=header"))).toBe("/learn?ref=header");
  });

  it("ignores non-home routes and unknown tabs", () => {
    expect(resolveLegacyLandingHref(createLocation("/profile", "?tab=cosmetics"))).toBeNull();
    expect(resolveLegacyLandingHref(createLocation("/", "?tab=unknown"))).toBeNull();
  });
});
