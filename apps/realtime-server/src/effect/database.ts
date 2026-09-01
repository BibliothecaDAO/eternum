import { Context, Effect, Layer } from "effect";

import { db } from "../db/client";
import { DatabaseFailure, DirectMessageRejected } from "./errors";

type DatabaseClient = typeof db;

interface ChatDatabaseService {
  readonly run: <A>(
    operation: string,
    task: (client: DatabaseClient) => Promise<A>,
  ) => Effect.Effect<A, DatabaseFailure | DirectMessageRejected>;
}

class ChatDatabase extends Context.Service<ChatDatabase, ChatDatabaseService>()("chat/ChatDatabase") {}

const ChatDatabaseLive = Layer.succeed(ChatDatabase, {
  run: (operation, task) =>
    Effect.tryPromise({
      try: () => task(db),
      catch: (cause) => (cause instanceof DirectMessageRejected ? cause : new DatabaseFailure({ operation, cause })),
    }),
});

export const databaseEffect = <A>(
  operation: string,
  task: (client: DatabaseClient) => Promise<A>,
): Effect.Effect<A, DatabaseFailure | DirectMessageRejected> =>
  ChatDatabase.pipe(
    Effect.flatMap((database) => database.run(operation, task)),
    Effect.provide(ChatDatabaseLive),
  );
