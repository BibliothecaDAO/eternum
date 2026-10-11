import { afterEach, expect, it, vi } from "vitest";
import { resendSignInCodes } from "./sign-in-codes";

afterEach(() => vi.unstubAllGlobals());

it("tells the recipient the code's ten-minute lifetime", async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", send);
  await resendSignInCodes("test-key")("player@realms.test", "123456");
  expect(send).toHaveBeenCalledOnce();
  expect(JSON.parse(send.mock.calls[0]![1]!.body as string)).toMatchObject({
    to: ["player@realms.test"],
    text: "Your Realms sign-in code is 123456. It expires in 10 minutes. If you did not ask for it, you can ignore this email.",
  });
});
