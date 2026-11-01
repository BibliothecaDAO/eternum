import { expect, it, vi } from "vitest";
import { readHeraldJson } from "./shard-snapshot";

it.each(["http://127.0.0.1:8081", "http://[::1]:8081", "https://herald.test"])(
  "reads a configured Herald at %s without following redirects",
  async (origin) => {
    const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ confirmed_block: 10 }));
    expect(await readHeraldJson(origin, "/games", network)).toEqual({ confirmed_block: 10 });
    expect(network).toHaveBeenCalledExactlyOnceWith(
      new URL("/games", origin),
      expect.objectContaining({ redirect: "manual", cache: "no-store" }),
    );
    network.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://attacker.test" } }));
    await expect(readHeraldJson(origin, "/games", network)).rejects.toThrow("confirmed_herald_read_unavailable");
    expect(network).toHaveBeenCalledTimes(2);
  },
);
it.each([
  "http://herald.test",
  "http://localhost:8081",
  "http://127.0.0.1.attacker.test",
  "http://user@127.0.0.1",
  "https://user@herald.test",
  "ftp://127.0.0.1",
])("refuses unsafe Herald endpoint %s before sending", async (origin) => {
  const network = vi.fn<typeof fetch>();
  await expect(readHeraldJson(origin, "/games", network)).rejects.toThrow("invalid_herald_url");
  expect(network).not.toHaveBeenCalled();
});
