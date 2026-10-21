/** An image the email carries itself, drawn by its `cid:` reference: it needs no host, though a client may still hide it. */
export interface InlineImage {
  id: string;
  filename: string;
  /** The JPEG, in base64. */
  content: string;
}

/** One email, as every Worker sends it. The text part always goes; the HTML and its images are optional. */
export interface Email {
  /** The sender's name; every email comes from no-reply@realms.party. */
  sender: "Realms" | "Realms status";
  to: string;
  subject: string;
  text: string;
  html?: string;
  images?: readonly InlineImage[];
  /** A retry sends exactly the same email under the same key, and Resend delivers it once. */
  idempotencyKey?: string;
}

/**
 * The one way an email leaves: Resend's API with the environment's key. The caller decides what a refusal means (the
 * identity Worker throws, the status monitor keeps the notice for its next minute).
 */
export const sendEmail = (apiKey: string, email: Email, network: typeof fetch = fetch): Promise<Response> =>
  network("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      ...(email.idempotencyKey ? { "idempotency-key": email.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: `${email.sender} <no-reply@realms.party>`,
      to: [email.to],
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
      ...(email.images?.length
        ? {
            attachments: email.images.map((image) => ({
              content: image.content,
              filename: image.filename,
              content_id: image.id,
              content_type: "image/jpeg",
            })),
          }
        : {}),
    }),
  });
