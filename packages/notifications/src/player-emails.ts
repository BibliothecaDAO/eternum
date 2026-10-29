import type { Email } from "./email";
import BRAND from "./brand.gen.json";
import { EMAIL_ART, type EmailArt } from "./email-art.gen";

/** The two emails a player gets, in the Realms look: a sign-in code, and a change to their payout wallet. */

export const signInCodeEmail = (options: { to: string; code: string; minutes: number; appUrl: string }): Email =>
  playerEmail({
    to: options.to,
    appUrl: options.appUrl,
    // The code first: inbox previews and Gmail's Copy code button read the subject.
    subject: `${options.code} is your Realms sign-in code`,
    preheader: `It expires in ${options.minutes} minutes.`,
    art: "sign-in-code",
    lines: [`Enter it in Realms to sign in. It expires in ${options.minutes} minutes.`],
    code: options.code,
    note: "If you did not ask for it, you can ignore this email.",
    because: `Someone asked to sign in to Realms with ${options.to}.`,
    text: `Your Realms sign-in code is ${options.code}. It expires in ${options.minutes} minutes. If you did not ask for it, you can ignore this email.`,
  });

/** A linked wallet, or none when it was unlinked. */
export const payoutWalletEmail = (options: {
  to: string;
  address: string | null;
  appUrl: string;
  idempotencyKey: string;
}): Email => {
  const secure = "If you did not make this change, sign in and secure your account.";
  const because = `Sent to ${options.to}, the email of your Realms account.`;
  const shared = { to: options.to, appUrl: options.appUrl, idempotencyKey: options.idempotencyKey, note: secure };
  if (options.address === null)
    return playerEmail({
      ...shared,
      subject: "Your Realms payout wallet was unlinked",
      preheader: "Your Realms account has no payout wallet now.",
      art: "wallet-unlinked",
      lines: ["Your Realms payout wallet was unlinked."],
      action: "Open Realms",
      because,
      text: `Your Realms payout wallet was unlinked. ${secure}`,
    });
  return playerEmail({
    ...shared,
    subject: "Your Realms payout wallet changed",
    preheader: `Your Realms payout wallet is now ${options.address.slice(0, 6)}…${options.address.slice(-5)}.`,
    art: "wallet-changed",
    lines: ["Your Realms payout wallet is now:"],
    detail: options.address,
    action: "Open Realms",
    because,
    text: `Your Realms payout wallet is now ${options.address}. ${secure}`,
  });
};

interface PlayerMessage {
  to: string;
  appUrl: string;
  subject: string;
  /** The inbox preview after the subject, in place of the email's first words. */
  preheader: string;
  art: EmailArt;
  lines: string[];
  /** A code to type: drawn large, one run of digits, so a copy gives exactly the code. */
  code?: string;
  /** A value to check, such as an address, drawn whole. */
  detail?: string;
  /** The one button, to the app. */
  action?: string;
  note: string;
  /** Why this email came, in the footer. */
  because: string;
  text: string;
  idempotencyKey?: string;
}

// The brand's colours and reading face, written from the game's token file (apps/game/src/brand/surfaces.ts), after
// the face the fallbacks every client has; the title is lettered in the art.
const { ground: NIGHT, line: LINE, cream: CREAM, muted: MUTED, gold: GOLD, gold2: GOLD2, ink: INK } = BRAND.colors;
const BODY = `'${BRAND.faces.body.family}','Segoe UI',Helvetica,Arial,sans-serif`;
const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

const ART_ID = "header";

const playerEmail = (message: PlayerMessage): Email => ({
  sender: "Realms",
  to: message.to,
  subject: message.subject,
  text: message.text,
  html: playerHtml(message),
  images: [{ id: ART_ID, filename: `${message.art}.jpg`, content: EMAIL_ART[message.art].jpeg }],
  ...(message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : {}),
});

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const row = (padding: string, content: string, style = "") =>
  `<tr><td class="px" style="padding:${padding};${style}">${content}</td></tr>`;

const box = (content: string, style: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:1px solid ${GOLD};border-radius:10px;${style}">${content}</td></tr></table>`;

const text = `font-family:${BODY};font-size:17px;line-height:26px;color:${CREAM}`;
const small = `font-family:${BODY};font-size:15px;line-height:23px;color:${MUTED}`;

function playerHtml(message: PlayerMessage): string {
  const rows = [
    `<tr><td style="padding:0;line-height:0;font-size:0"><img src="cid:${ART_ID}" width="600" alt="Realms: ${escape(EMAIL_ART[message.art].title)}" style="width:100%;max-width:600px;height:auto;display:block;border-radius:12px 12px 0 0"></td></tr>`,
    ...message.lines.map((line, index) => row(`${index === 0 ? 28 : 16}px 40px 0`, escape(line), text)),
  ];
  if (message.code)
    rows.push(
      row(
        "24px 40px 0",
        box(
          `<div class="code" style="font-family:${BODY};font-size:44px;line-height:52px;font-weight:700;letter-spacing:12px;padding-left:12px;color:${GOLD2}">${escape(message.code)}</div>`,
          "padding:22px 12px;text-align:center",
        ),
      ),
    );
  if (message.detail)
    rows.push(
      row(
        "16px 40px 0",
        box(
          escape(message.detail),
          `padding:14px 16px;font-family:${MONO};font-size:14px;line-height:22px;color:${GOLD2};word-break:break-all`,
        ),
      ),
    );
  if (message.action)
    rows.push(
      row(
        "24px 40px 0",
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${GOLD};border-radius:8px"><a href="${escape(message.appUrl)}" style="display:inline-block;padding:14px 28px;font-family:${BODY};font-size:16px;font-weight:700;color:${INK};text-decoration:none">${escape(message.action)}</a></td></tr></table>`,
      ),
    );
  rows.push(
    row("24px 40px 0", escape(message.note), small),
    row("32px 40px 0", `<div style="height:1px;line-height:1px;font-size:0;background:${LINE}">&nbsp;</div>`),
    row(
      "18px 40px 36px",
      `<a href="${escape(message.appUrl)}" style="color:${GOLD};text-decoration:none;font-weight:700">Realms</a> · fully onchain strategy<br>${escape(message.because)}`,
      `font-family:${BODY};font-size:13px;line-height:20px;color:${MUTED}`,
    ),
  );

  // The hidden preheader is padded so a client shows it alone, not followed by the email's first words.
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
<title>${escape(message.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%} table{border-collapse:collapse} img{border:0;outline:none;text-decoration:none}
@media (max-width:620px){ .px{padding-left:24px !important;padding-right:24px !important} .code{font-size:36px !important;letter-spacing:8px !important;padding-left:8px !important} }
</style>
</head>
<body style="margin:0;padding:0;background:${NIGHT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escape(message.preheader)}${"&#847;&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NIGHT}"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:${NIGHT};border:1px solid ${LINE};border-radius:12px">
${rows.join("\n")}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body>
</html>
`;
}
