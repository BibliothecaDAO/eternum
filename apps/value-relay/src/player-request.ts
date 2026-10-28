export class PlayerRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export interface PlayerIdentity {
  origin: string;
  authenticate(cookie: string): Promise<{ realmsId: string } | null>;
  accountForRealmsId(id: string): Promise<string | null>;
}

/** Mutating player routes bind their account to the authenticated identity, never to request fields. */
export async function playerRequest(
  request: Request,
  identity: PlayerIdentity,
  run: (player: { realmsId: string; account: string }) => Promise<unknown>,
): Promise<Response> {
  try {
    if (request.headers.get("origin") !== new URL(identity.origin).origin)
      throw new PlayerRequestError(403, "invalid_origin");
    const session = await identity.authenticate(request.headers.get("cookie") ?? "");
    if (!session) throw new PlayerRequestError(401, "unauthorized");
    const account = await identity.accountForRealmsId(session.realmsId);
    if (!account) throw new PlayerRequestError(403, "account_unavailable");
    return Response.json(await run({ realmsId: session.realmsId, account }), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof PlayerRequestError ? error.code : "value_service_unavailable" },
      { status: error instanceof PlayerRequestError ? error.status : 503 },
    );
  }
}

export async function readPlayerBody<T>(request: Request, decode: (body: unknown) => T, error: string): Promise<T> {
  try {
    return decode(await request.json());
  } catch {
    throw new PlayerRequestError(400, error);
  }
}
