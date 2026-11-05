// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ART } from "../scripts/email-art-inputs.mjs";
import { HEADER, TITLE_MARGIN, titlesTooWide } from "../scripts/email-art-title.mjs";

describe("the email headers' titles", () => {
  it("letters every title inside the header's margins (scripts/email-art-title.mjs)", async () => {
    expect(await titlesTooWide(ART)).toEqual([]);
  });

  it("names a title too wide to fit, with its width and the room between the margins", async () => {
    const room = HEADER.width - 2 * TITLE_MARGIN;
    const [tooWide, ...others] = await titlesTooWide({ long: { title: "Wallet recovery started" } });
    expect(others).toEqual([]);
    expect(tooWide).toMatchObject({ id: "long", title: "Wallet recovery started", room });
    expect(tooWide!.width).toBeGreaterThan(room);
  });
});
