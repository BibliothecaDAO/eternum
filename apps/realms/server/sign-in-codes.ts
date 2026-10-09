/** Delivers a one-time sign-in code to an email address; the provider sits behind this one call. */
export type SendSignInCode = (email: string, code: string) => Promise<void>;

/** Resend's transactional email API, with the environment's RESEND_API_KEY. */
export const resendSignInCodes =
  (apiKey: string): SendSignInCode =>
  (email, code) =>
    sendIdentityEmail(
      apiKey,
      email,
      `${code} is your Realms sign-in code`,
      `Your Realms sign-in code is ${code}. It expires in 5 minutes. If you did not ask for it, you can ignore this email.`,
    );

export async function sendIdentityEmail(
  apiKey: string,
  email: string,
  subject: string,
  text: string,
  id?: string,
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(id ? { "idempotency-key": id } : {}),
    },
    body: JSON.stringify({ from: "Realms <no-reply@realms.party>", to: [email], subject, text }),
  });
  if (!response.ok) throw new Error(`Identity email delivery refused: ${response.status}`);
}
