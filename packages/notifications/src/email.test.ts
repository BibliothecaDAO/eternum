import { expect, it, vi } from "vitest";
import { sendEmail } from "./email";

const resend = () => vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
const request = (network: ReturnType<typeof resend>) => {
  const [url, init] = network.mock.calls[0]!;
  return { url: String(url), headers: new Headers(init!.headers), body: JSON.parse(init!.body as string) };
};

it("sends an email with its art as inline images, once per idempotency key", async () => {
  const network = resend();
  await sendEmail(
    "test-key",
    {
      sender: "Realms",
      to: "lord@realms.test",
      subject: "552467 is your Realms sign-in code",
      text: "plain words",
      html: '<img src="cid:header">',
      images: [{ id: "header", filename: "sign-in-code.jpg", content: "/9j/AAAA" }],
      idempotencyKey: "notice-1",
    },
    network,
  );
  const sent = request(network);
  expect(sent.url).toBe("https://api.resend.com/emails");
  expect(sent.headers.get("authorization")).toBe("Bearer test-key");
  expect(sent.headers.get("idempotency-key")).toBe("notice-1");
  expect(sent.body).toEqual({
    from: "Realms <no-reply@realms.party>",
    to: ["lord@realms.test"],
    subject: "552467 is your Realms sign-in code",
    text: "plain words",
    html: '<img src="cid:header">',
    attachments: [
      { content: "/9j/AAAA", filename: "sign-in-code.jpg", content_id: "header", content_type: "image/jpeg" },
    ],
  });
});

it("sends a plain-text email as plain text alone", async () => {
  const network = resend();
  await sendEmail("test-key", { sender: "Realms status", to: "oncall@realms.test", subject: "s", text: "t" }, network);
  const sent = request(network);
  expect(sent.headers.has("idempotency-key")).toBe(false);
  expect(sent.body).toEqual({
    from: "Realms status <no-reply@realms.party>",
    to: ["oncall@realms.test"],
    subject: "s",
    text: "t",
  });
});
