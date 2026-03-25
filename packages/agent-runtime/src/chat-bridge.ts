import { RealtimeClient } from "@bibliothecadao/types";

import type { PublishAgentWorldChatInput } from "./types";

export async function publishAgentWorldChat(input: PublishAgentWorldChatInput): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let client:
      | {
          close(): void;
          send(message: unknown): void;
        }
      | undefined;
    const timeout = setTimeout(() => {
      client?.close();
      reject(new Error("Timed out publishing agent world chat."));
    }, input.timeoutMs ?? 5_000);

    client = new RealtimeClient({
      baseUrl: input.baseUrl,
      playerId: `agent:${input.agentId}`,
      queryParams: input.queryParams,
      onOpen: () => {
        client?.send({
          type: "world:publish",
          zoneId: input.zoneId,
          payload: {
            zoneId: input.zoneId,
            content: input.content,
            metadata: {
              ...input.metadata,
              agent: {
                agentId: input.agentId,
                kind: input.kind,
              },
            },
          },
        });

        clearTimeout(timeout);
        client?.close();
        resolve();
      },
      onError: (event: Event) => {
        clearTimeout(timeout);
        client?.close();
        reject(event instanceof Error ? event : new Error("Failed to publish agent world chat."));
      },
    });
  });
}
