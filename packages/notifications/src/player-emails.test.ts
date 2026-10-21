import { describe, expect, it } from "vitest";
import { payoutWalletEmail, signInCodeEmail } from "./player-emails";
import type { Email } from "./email";

const APP = "https://play.realms.test";
const WALLET = "0x04a1b2c3d4e5f60718293a4b5c6d7e8f9012a3b4c5d6e7f8091a2b3c4d5e6f7c3f2";

const imageSources = (html: string) => [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map(([, src]) => src);
const links = (html: string) => [...html.matchAll(/<a[^>]*\shref="([^"]+)"/g)].map(([, href]) => href);
const jpegBytes = (email: Email) =>
  email.images!.map((image) => Uint8Array.from(atob(image.content), (char) => char.charCodeAt(0)));

/** Every image the HTML draws travels with the email, as a JPEG, and the whole stays a sane size. */
const expectSelfContained = (email: Email) => {
  const ids = email.images!.map((image) => image.id);
  expect(imageSources(email.html!).map((src) => src.replace(/^cid:/, ""))).toEqual(ids);
  for (const bytes of jpegBytes(email)) expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  expect(jpegBytes(email).reduce((total, bytes) => total + bytes.length, 0)).toBeLessThan(100_000);
  expect(email.html!.length).toBeLessThan(20_000);
  expect(links(email.html!).every((href) => href === APP)).toBe(true);
};

describe("the sign-in code email", () => {
  const email = signInCodeEmail({ to: "lord@realms.test", code: "552467", minutes: 10, appUrl: APP });

  it("leads its subject with the code and keeps today's plain text", () => {
    expect(email).toMatchObject({
      sender: "Realms",
      to: "lord@realms.test",
      subject: "552467 is your Realms sign-in code",
      text: "Your Realms sign-in code is 552467. It expires in 10 minutes. If you did not ask for it, you can ignore this email.",
    });
  });

  it("draws the code as one run of digits, so a copy gives exactly the code", () => {
    expect(email.html).toMatch(/>552467<\/div>/);
    expect(email.html).not.toMatch(/5\s+5\s*2\s*4\s*6\s*7/);
  });

  it("previews the expiry in the inbox, not the email's first words", () => {
    expect(email.html).toMatch(/<body[^>]*>\s*<div style="display:none[^"]*">It expires in 10 minutes\./);
  });

  it("carries its art inline, under the title the art is lettered with", () => {
    expectSelfContained(email);
    expect(email.images).toHaveLength(1);
    expect(email.html).toContain('alt="Realms: Your sign-in code"');
  });

  it("writes the recipient's address as text, never as markup", () => {
    const tricky = signInCodeEmail({ to: 'a&b"<x>@realms.test', code: "123456", minutes: 10, appUrl: APP });
    expect(tricky.html).toContain("a&amp;b&quot;&lt;x&gt;@realms.test");
    expect(tricky.html).not.toContain('a&b"<x>');
  });
});

describe("the payout wallet email", () => {
  it("shows the new wallet whole, sends once per notice and keeps today's plain text", () => {
    const email = payoutWalletEmail({
      to: "lord@realms.test",
      address: WALLET,
      appUrl: APP,
      idempotencyKey: "notice-1",
    });
    expect(email).toMatchObject({
      sender: "Realms",
      subject: "Your Realms payout wallet changed",
      idempotencyKey: "notice-1",
      text: `Your Realms payout wallet is now ${WALLET}. If you did not make this change, sign in and secure your account.`,
    });
    expect(email.html).toContain(`>${WALLET}</td>`);
    expect(email.html).toContain(`>Open Realms</a>`);
    expect(email.html).toContain('alt="Realms: Payout wallet changed"');
    expectSelfContained(email);
  });

  it("says an unlinked wallet was unlinked, in the subject as in the body", () => {
    const email = payoutWalletEmail({ to: "lord@realms.test", address: null, appUrl: APP, idempotencyKey: "notice-2" });
    expect(email).toMatchObject({
      subject: "Your Realms payout wallet was unlinked",
      text: "Your Realms payout wallet was unlinked. If you did not make this change, sign in and secure your account.",
    });
    expect(email.html).toContain('alt="Realms: Payout wallet unlinked"');
    expect(email.images![0]!.filename).toBe("wallet-unlinked.jpg");
    expectSelfContained(email);
  });
});
