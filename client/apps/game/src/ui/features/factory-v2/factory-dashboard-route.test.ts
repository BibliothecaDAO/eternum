import { describe, expect, it } from "vitest";

import {
  resolveFactoryDashboardVersion,
  updateFactoryDashboardVersion,
  LEGACY_FACTORY_DASHBOARD_ROUTE,
  FACTORY_V2_DASHBOARD_ROUTE,
} from "./factory-dashboard-route";

describe("factory dashboard route", () => {
  it("defaults to Factory V2 when no version is provided", () => {
    expect(resolveFactoryDashboardVersion(new URLSearchParams())).toBe("v2");
  });

  it("resolves the legacy dashboard version from search params", () => {
    expect(resolveFactoryDashboardVersion(new URLSearchParams("tab=factory&factoryVersion=v1"))).toBe("v1");
  });

  it("writes the selected dashboard version back into the URL while preserving other params", () => {
    const nextSearchParams = updateFactoryDashboardVersion(new URLSearchParams("tab=play&foo=bar"), "v1");

    expect(nextSearchParams.get("tab")).toBe("factory");
    expect(nextSearchParams.get("factoryVersion")).toBe("v1");
    expect(nextSearchParams.get("foo")).toBe("bar");
  });

  it("publishes stable redirect targets for direct factory routes", () => {
    expect(LEGACY_FACTORY_DASHBOARD_ROUTE).toBe("/?tab=factory&factoryVersion=v1");
    expect(FACTORY_V2_DASHBOARD_ROUTE).toBe("/?tab=factory&factoryVersion=v2");
  });
});
