/**
 * Whether a request carries the environment's operator token as a bearer token: one secret per environment for all
 * operator automation (the directory's admin routes, launches and slots). Compared by digest, so the comparison time
 * says nothing about the token.
 */
export const presentsOperatorToken = async (request: Request, operatorToken: string): Promise<boolean> => {
  const presented = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (presented.length === 0) return false;
  const [expected, actual] = await Promise.all([operatorToken, presented].map(digest));
  return expected === actual;
};

const digest = async (value: string) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))].join(",");
