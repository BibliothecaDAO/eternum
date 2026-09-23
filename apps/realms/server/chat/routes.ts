import { profileOfIdentityUser } from "@realms-world/identity";
import { GLOBAL_CHAT_CHANNEL_ID } from "@bibliothecadao/types";

import type { IdentityAuth } from "../auth";
import type { IdentityEnv } from "../env";
import { json } from "../http";
import { chatMemberHeaders } from "./chat-sockets";
import { gameRoomsOf, isRoomMember, parseChatRoom } from "./rooms";

const HISTORY_LIMIT = 50;
const HISTORY_MAX = 100;

/**
 * /api/chat/*: the signed-in account's inbox socket, a room socket once membership is checked, the two histories the
 * chat reads, and the account's block list. The Worker authenticates; the objects trust the member it names.
 */
export const routeChat = async (
  request: Request,
  env: IdentityEnv,
  auth: IdentityAuth,
  pathname: string,
): Promise<Response> => {
  const member = await chatMemberFrom(request, auth);
  if (!member) return json({ error: "unauthorized" }, 401);
  const url = new URL(request.url);

  if (pathname === "/api/chat/inbox" && isSocketUpgrade(request)) {
    const rooms = [GLOBAL_CHAT_CHANNEL_ID, ...(await gameRoomsOf(env.DB, member.realmsId))];
    return env.CHAT_INBOX.get(env.CHAT_INBOX.idFromName(member.realmsId)).fetch(
      forward(request, { ...chatMemberHeaders(member), "x-chat-rooms": JSON.stringify(rooms) }),
    );
  }

  const roomSocket = /^\/api\/chat\/rooms\/([^/]+)$/.exec(pathname);
  if (roomSocket && isSocketUpgrade(request)) {
    const room = parseChatRoom(decodeURIComponent(roomSocket[1]!));
    if (!room) return json({ error: "invalid_channel" }, 400);
    if (!(await isRoomMember(env.DB, member.realmsId, room))) return json({ error: "channel_access_denied" }, 403);
    return env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(room)).fetch(
      forward(request, { ...chatMemberHeaders(member), "x-chat-room": room }),
    );
  }

  if (pathname === "/api/chat/world" && request.method === "GET") {
    const room = parseChatRoom(url.searchParams.get("zoneId"));
    if (!room) return json({ error: "invalid_channel" }, 400);
    if (!(await isRoomMember(env.DB, member.realmsId, room))) return json({ error: "channel_access_denied" }, 403);
    return json(
      await env.CHAT_ROOM.get(env.CHAT_ROOM.idFromName(room)).history(
        url.searchParams.get("cursor") ?? undefined,
        pageSize(url),
      ),
    );
  }

  const blocks = /^\/api\/chat\/blocks(?:\/([^/]+))?$/.exec(pathname);
  if (blocks) return routeBlocks(request, env, member.realmsId, blocks[1] ? decodeURIComponent(blocks[1]) : undefined);

  const threadHistory = /^\/api\/chat\/dm\/threads\/([^/]+)\/messages$/.exec(pathname);
  if (threadHistory && request.method === "GET") {
    const page = await env.CHAT_INBOX.get(env.CHAT_INBOX.idFromName(member.realmsId)).threadMessages(
      decodeURIComponent(threadHistory[1]!),
      url.searchParams.get("cursor") ?? undefined,
      pageSize(url),
    );
    return page ? json(page) : json({ error: "thread_not_found" }, 404);
  }

  return json({ error: "not_found" }, 404);
};

const REALMS_ID = /^0x[0-9a-fA-F]{1,64}$/;

/**
 * /api/chat/blocks: the signed-in account's block list. GET lists it, POST {realmsId} blocks an account, and
 * DELETE /api/chat/blocks/:realmsId unblocks it. A blocked account's direct messages are dropped at this inbox.
 */
const routeBlocks = async (request: Request, env: IdentityEnv, owner: string, target: string | undefined) => {
  const inbox = env.CHAT_INBOX.get(env.CHAT_INBOX.idFromName(owner));
  if (request.method === "GET" && !target) return json({ blocked: await inbox.blocked() });
  if (request.method === "POST" && !target) {
    const body = (await request.json().catch(() => null)) as { realmsId?: unknown } | null;
    const realmsId = typeof body?.realmsId === "string" && REALMS_ID.test(body.realmsId) ? body.realmsId : null;
    if (!realmsId || BigInt(realmsId) === BigInt(owner)) return json({ error: "invalid_realms_id" }, 400);
    await inbox.block(canonical(realmsId));
    return json({ blocked: await inbox.blocked() });
  }
  if (request.method === "DELETE" && target && REALMS_ID.test(target)) {
    await inbox.unblock(canonical(target));
    return json({ blocked: await inbox.blocked() });
  }
  return json({ error: "not_found" }, 404);
};

const canonical = (realmsId: string) => `0x${BigInt(realmsId).toString(16)}`;

const chatMemberFrom = async (request: Request, auth: IdentityAuth) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user.realmsId) return null;
  const { id, name, image } = session.user;
  return {
    realmsId: session.user.realmsId,
    displayName: profileOfIdentityUser({ id, name, image: image ?? null }).name,
  };
};

const isSocketUpgrade = (request: Request) =>
  request.method === "GET" && request.headers.get("upgrade")?.toLowerCase() === "websocket";

/** The client's upgrade request, carrying the member the Worker authenticated and nothing it could forge. */
const forward = (request: Request, headers: Record<string, string>) => {
  const forwarded = new Headers(request.headers);
  for (const name of ["x-realms-id", "x-display-name", "x-chat-room", "x-chat-rooms"]) forwarded.delete(name);
  for (const [name, value] of Object.entries(headers)) forwarded.set(name, value);
  return new Request(request.url, { method: "GET", headers: forwarded });
};

const pageSize = (url: URL) =>
  Math.min(Math.max(Number(url.searchParams.get("limit")) || HISTORY_LIMIT, 1), HISTORY_MAX);
