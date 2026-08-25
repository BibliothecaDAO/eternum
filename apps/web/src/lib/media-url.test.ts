import { describe, expect, it } from "vitest";

import { getNextMediaLoadAttempt, resolveIpfsMediaUrl, withMediaRetryAttempt } from "./media-url";

describe("resolveIpfsMediaUrl", () => {
  it("uses the browser-loadable default gateway for legacy IPFS URLs", () => {
    expect(
      resolveIpfsMediaUrl("https://gateway.pinata.cloud/ipfs/QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi"),
    ).toBe("https://ipfs.filebase.io/ipfs/QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi");
  });

  it("routes legacy IPFS gateway URLs through the configured gateway", () => {
    expect(
      resolveIpfsMediaUrl(
        "https://gateway.pinata.cloud/ipfs/QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi",
        "https://ipfs.io/ipfs/",
      ),
    ).toBe("https://ipfs.io/ipfs/QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi");
  });

  it("routes ipfs scheme URLs through the configured gateway", () => {
    expect(resolveIpfsMediaUrl("ipfs://QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi", "https://ipfs.io/ipfs/")).toBe(
      "https://ipfs.io/ipfs/QmSLowoHFTCm3AmxNBDtLpjmsKg8rsPw9QgG9JfHhJemwi",
    );
  });
});

describe("media image retries", () => {
  it("allows two bounded retries before entering the error state", () => {
    expect(getNextMediaLoadAttempt(0)).toBe(1);
    expect(getNextMediaLoadAttempt(1)).toBe(2);
    expect(getNextMediaLoadAttempt(2)).toBeNull();
  });

  it("cache-busts retry attempts without changing the first request", () => {
    const imageUrl = "https://ipfs.filebase.io/ipfs/QmW9kQ85bD36Un4pHL1mi75sMHpq1LHBovdRpqvn4EC18J";

    expect(withMediaRetryAttempt(imageUrl, 0)).toBe(imageUrl);
    expect(withMediaRetryAttempt(imageUrl, 1)).toBe(`${imageUrl}?realmsRetry=1`);
  });
});
