// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Boot loader crash fallback wiring", () => {
  it("uses a dedicated fallback that advances the boot shell to a terminal state", () => {
    const fallbackSource = readSource("src/ui/modules/boot-loader/boot-loader-fallback.tsx");
    const mainSource = readSource("src/main.tsx");

    expect(fallbackSource).toContain('useBootDocumentState("app-ready")');
    expect(mainSource).toContain("<BootLoaderCrashFallback />");
  });

  it("wraps the non-Sentry render path with a boot-only crash fallback", () => {
    const mainSource = readSource("src/main.tsx");

    expect(mainSource).toContain("class BootCrashBoundary extends React.Component");
    expect(mainSource).not.toContain('from "./ui/shared/error-boundary"');
    expect(mainSource).toMatch(
      /:\s*\(\s*<BootCrashBoundary fallback={<BootLoaderCrashFallback \/>}>\s*<App \/>\s*<\/BootCrashBoundary>\s*\)/s,
    );
  });
});
