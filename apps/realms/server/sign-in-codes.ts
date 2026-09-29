/** Delivers a one-time sign-in code to an email address; the provider sits behind this one call. */
export type SendSignInCode = (email: string, code: string) => Promise<void>;

const SIGN_IN_CODE_FROM = "Realms <no-reply@realms.party>";

/** Resend's transactional email API, with the environment's RESEND_API_KEY. */
export const resendSignInCodes =
  (apiKey: string): SendSignInCode =>
  async (email, code) => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: SIGN_IN_CODE_FROM,
        to: [email],
        subject: `${code} is your Realms sign-in code`,
        text: `Your Realms sign-in code is ${code}. It expires in 5 minutes. If you did not ask for it, you can ignore this email.`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Resend refused the sign-in code email: ${response.status} ${await response.text()}`);
    }
  };
