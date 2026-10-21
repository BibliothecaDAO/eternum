import { afterEach, expect, it, vi } from "vitest";
import { resendSignInCodes } from "./sign-in-codes";

afterEach(() => vi.unstubAllGlobals());

it("sends the Realms sign-in email: the code first in the subject, its ten-minute lifetime, the art inline", async () => {
  const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", send);
  await resendSignInCodes("test-key", "https://play.realms.test")("player@realms.test", "123456");
  expect(send).toHaveBeenCalledOnce();
  const [, init] = send.mock.calls[0] ?? [];
  const body = JSON.parse(init?.body as string) as { html: string; attachments: unknown[] };
  expect(body).toMatchObject({
    from: "Realms <no-reply@realms.party>",
    to: ["player@realms.test"],
    subject: "123456 is your Realms sign-in code",
    text: "Your Realms sign-in code is 123456. It expires in 10 minutes. If you did not ask for it, you can ignore this email.",
  });
  expect(body.html).toContain(">123456</div>");
  expect(body.attachments).toEqual([expect.objectContaining({ content_id: "header", filename: "sign-in-code.jpg" })]);
});

it("throws when the provider refuses, so the code is not lost silently", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 422 })));
  await expect(
    resendSignInCodes("test-key", "https://play.realms.test")("player@realms.test", "123456"),
  ).rejects.toThrow("Identity email delivery refused: 422");
});
