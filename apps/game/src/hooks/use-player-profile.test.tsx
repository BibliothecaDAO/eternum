import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { usePlayerNames } from "@/hooks/use-player-profile";

afterEach(() => vi.unstubAllGlobals());

// A shared card's image is made again when its names reader changes (usePreparedCard), so the reader must change when
// a profile answers late, and stay the same object through renders that change nothing.
it("gives a new names reader when a profile answers late, and the same one through a render that changes nothing", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let reply!: (value: Response) => void;
  vi.stubGlobal("fetch", () => new Promise<Response>((resolve) => (reply = resolve)));
  const reads: { reader: ReturnType<typeof usePlayerNames>; name: string }[] = [];
  const Card = () => {
    const names = usePlayerNames();
    const name = names.text("0xabc55221");
    reads.push({ reader: names, name });
    return <div>{name}</div>;
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => root.render(<Card />));
    const waiting = reads.at(-1)!;
    expect(waiting.name).toBe("…");
    await act(async () => {
      reply(Response.json({ profiles: { "0xabc55221": { name: "Ashwalker", portrait: null } } }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const answered = reads.at(-1)!;
    expect(answered.name).toBe("Ashwalker");
    expect(answered.reader).not.toBe(waiting.reader);
    await act(async () => root.render(<Card />));
    expect(reads.at(-1)!.reader).toBe(answered.reader);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
