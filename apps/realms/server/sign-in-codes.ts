import { sendEmail, signInCodeEmail } from "@bibliothecadao/notifications";
import type { Email } from "@bibliothecadao/notifications";
import { SIGN_IN_CODE_SECONDS } from "@realms-world/identity";

/** Delivers a one-time sign-in code to an email address; the provider sits behind this one call. */
export type SendSignInCode = (email: string, code: string) => Promise<void>;

/** The sign-in code email, sent with the environment's RESEND_API_KEY; its button and footer open the app at appUrl. */
export const resendSignInCodes =
  (apiKey: string, appUrl: string): SendSignInCode =>
  (email, code) =>
    sendIdentityEmail(apiKey, signInCodeEmail({ to: email, code, minutes: SIGN_IN_CODE_SECONDS / 60, appUrl }));

/** An identity email the caller must know was accepted: a refusal throws, so the code or notice is not lost silently. */
export async function sendIdentityEmail(apiKey: string, email: Email): Promise<void> {
  const response = await sendEmail(apiKey, email);
  if (!response.ok) throw new Error(`Identity email delivery refused: ${response.status}`);
}
