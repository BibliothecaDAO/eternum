import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnershipStatusAlert } from "./ownership-status-alert";

describe("OwnershipStatusAlert", () => {
  it.each([
    ["unavailable", "Realm inventory indexer is unavailable"],
    ["syncing", "Realm inventory is syncing"],
    ["stale", "Realm inventory updates are delayed"],
  ] as const)("renders the %s inventory state", (status, expectedTitle) => {
    const html = renderToStaticMarkup(<OwnershipStatusAlert status={status} />);

    expect(html).toContain(expectedTitle);
    expect(html).not.toContain("No Realms Found");
  });

  it("renders query failures as an explicit inventory error", () => {
    const html = renderToStaticMarkup(<OwnershipStatusAlert isError />);

    expect(html).toContain("Realm inventory is unavailable");
  });

  it("renders no alert for a ready inventory", () => {
    expect(renderToStaticMarkup(<OwnershipStatusAlert status="ready" />)).toBe(
      "",
    );
  });
});
