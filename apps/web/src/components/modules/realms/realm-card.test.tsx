import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RealmCard } from "./realm-card";

describe("RealmCard metadata states", () => {
  it("settles on an unavailable image when on-chain metadata cannot be read", () => {
    const html = renderToStaticMarkup(
      <RealmCard
        isGrid
        token={{ token_id: 3324, metadata_status: "unavailable" }}
      />,
    );

    expect(html).toContain("Image unavailable");
    expect(html).toContain("Realm #3324");
  });
});
