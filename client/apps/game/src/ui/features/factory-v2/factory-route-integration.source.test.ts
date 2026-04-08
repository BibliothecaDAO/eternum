// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Factory route integration", () => {
  it("redirects standalone factory routes into the inline dashboard tab", () => {
    const appSource = readSource("src/app.tsx");

    expect(appSource).toContain("LEGACY_FACTORY_DASHBOARD_ROUTE");
    expect(appSource).toContain("FACTORY_V2_DASHBOARD_ROUTE");
    expect(appSource).toContain(
      '<Route path="/factory" element={<Navigate to={LEGACY_FACTORY_DASHBOARD_ROUTE} replace />} />',
    );
    expect(appSource).toContain(
      '<Route path="/factory/v2" element={<Navigate to={FACTORY_V2_DASHBOARD_ROUTE} replace />} />',
    );
    expect(appSource).not.toContain("const FactoryV2Page = lazy(");
  });

  it("uses search params as the source of truth for the selected factory version", () => {
    const playViewSource = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(playViewSource).toContain("resolveFactoryDashboardVersion");
    expect(playViewSource).toContain("updateFactoryDashboardVersion");
    expect(playViewSource).not.toContain('useState<FactoryVersion>("v2")');
  });
});
